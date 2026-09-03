import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { MachineTokenController } from '../src/machine-auth/machine-auth.controller';
import { MachineAuthorityController } from '../src/machine-auth/machine-authority.controller';
import { MACHINE_AUTH_CONTRACT, type MachineJwtPayload } from '../src/machine-auth/machine-auth.contract';
import { MachineAuthService } from '../src/machine-auth/machine-auth.service';
import { MachineJwtAuthGuard } from '../src/machine-auth/machine-jwt-auth.guard';
import { MachineJwtStrategy } from '../src/machine-auth/machine-jwt.strategy';

const jwtSecret = 'agm-test-only-jwt-secret-never-use-in-production';
const companyA = '30000000-0000-4000-8000-000000000001';
const companyB = '30000000-0000-4000-8000-000000000002';
const identityId = '10000000-0000-4000-8000-000000000001';
const credentialId = '20000000-0000-4000-8000-000000000001';

describe('M2M HTTP authentication boundary', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const machines = {
    issueToken: jest.fn(),
    validateAccess: jest.fn(async (payload: MachineJwtPayload) => {
      if (payload.scope !== MACHINE_AUTH_CONTRACT.scope || payload.token_use !== MACHINE_AUTH_CONTRACT.tokenUse) throw new UnauthorizedException();
      if (payload.credential_id !== credentialId) throw new UnauthorizedException();
      return {
        requestId: '50000000-0000-4000-8000-000000000001',
        correlationId: '60000000-0000-4000-8000-000000000001',
        companyId: payload.companyId,
        subject: payload.sub,
        machineIdentityId: payload.client_id,
        credentialId: payload.credential_id,
        scopes: [payload.scope],
      };
    }),
  };
  const authority = { registryReadOnly: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: jwtSecret })],
      controllers: [MachineTokenController, MachineAuthorityController],
      providers: [
        MachineJwtStrategy,
        MachineJwtAuthGuard,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: jwtSecret }) },
        { provide: MachineAuthService, useValue: machines },
        { provide: AuthorityControlPlaneService, useValue: authority },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = module.get(JwtService);
  });

  afterAll(async () => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('rejects caller-controlled subject and companyId at token issuance', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/m2m/token').send({
      grant_type: 'client_credentials',
      client_id: identityId,
      client_secret: `${credentialId}.${'a'.repeat(64)}`,
      subject: 'caller-chosen',
      companyId: companyB,
    }).expect(400);
    expect(machines.issueToken).not.toHaveBeenCalled();
  });

  it('rejects a token with the wrong issuer', async () => {
    await expectProtected(token({ issuer: 'https://attacker.invalid' }), 401);
  });

  it('rejects a token with the wrong audience', async () => {
    await expectProtected(token({ audience: 'other-service' }), 401);
  });

  it('rejects a token with insufficient scope', async () => {
    await expectProtected(token({ scope: 'acp:none' }), 401);
  });

  it('rejects cross-company access after successful machine authentication', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/m2m/authority-control-plane/companies/${companyB}/network-registry`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(403);
    expect(authority.registryReadOnly).not.toHaveBeenCalled();
  });

  it('allows only the credential tenant read-only registry route', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/m2m/authority-control-plane/companies/${companyA}/network-registry`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);
    expect(authority.registryReadOnly).toHaveBeenCalledWith(companyA);
  });

  function token(overrides: { issuer?: string; audience?: string; scope?: string } = {}) {
    return jwt.sign({
      sub: 'acp-reader-1',
      companyId: companyA,
      client_id: identityId,
      credential_id: credentialId,
      scope: overrides.scope ?? MACHINE_AUTH_CONTRACT.scope,
      token_use: MACHINE_AUTH_CONTRACT.tokenUse,
    }, {
      issuer: overrides.issuer ?? MACHINE_AUTH_CONTRACT.issuer,
      audience: overrides.audience ?? MACHINE_AUTH_CONTRACT.audience,
      expiresIn: 300,
    });
  }

  async function expectProtected(accessToken: string, status: number) {
    await request(app.getHttpServer())
      .get(`/api/v1/m2m/authority-control-plane/companies/${companyA}/network-registry`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(status);
  }
});
