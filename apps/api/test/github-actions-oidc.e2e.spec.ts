import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DeploymentMachineProvisioningController } from '../src/machine-auth/machine-auth.controller';
import { GitHubActionsOidcGuard } from '../src/machine-auth/github-actions-oidc.guard';
import { GitHubActionsOidcService } from '../src/machine-auth/github-actions-oidc.service';
import { MachineAuthService } from '../src/machine-auth/machine-auth.service';

const companyId = '30000000-0000-4000-8000-000000000001';
const identityId = '10000000-0000-4000-8000-000000000001';
const credentialId = '20000000-0000-4000-8000-000000000001';

describe('GitHub Actions OIDC deployment HTTP boundary', () => {
  let app: INestApplication;
  const oidc = {
    authenticate: jest.fn().mockResolvedValue({
      userId: 'github-actions-oidc',
      companyId,
      roles: ['DEPLOYMENT_PROVISIONER'],
      requestId: '',
      correlationId: '',
      actorType: 'GitHubActionsOIDC',
      actorSubject: 'repo:adrianmuscalu2-ai/agm-cockpit:environment:Production',
      actorMetadata: { sha: 'a'.repeat(40), runId: '33773656386' },
    }),
  };
  const machines = {
    provision: jest.fn().mockResolvedValue({
      clientId: identityId,
      clientSecret: `${credentialId}.${'a'.repeat(64)}`,
      credentialId,
      subject: 'production-release-33773656386-1',
      companyId,
      scopes: ['acp:read'],
      expiresAt: new Date('2026-09-04T00:00:00.000Z'),
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeploymentMachineProvisioningController],
      providers: [
        GitHubActionsOidcGuard,
        { provide: GitHubActionsOidcService, useValue: oidc },
        { provide: MachineAuthService, useValue: machines },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('rejects a deployment provisioning request without a bearer credential', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/deploy/machines')
      .send({ subject: 'production-release-33773656386-1', expiresInDays: 1 })
      .expect(401);
    expect(oidc.authenticate).not.toHaveBeenCalled();
    expect(machines.provision).not.toHaveBeenCalled();
  });

  it('passes only the guard-derived tenant and deployment authority to provisioning', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/deploy/machines')
      .set('Authorization', 'Bearer github-actions-oidc-token')
      .set('x-request-id', '50000000-0000-4000-8000-000000000001')
      .send({ subject: 'production-release-33773656386-1', expiresInDays: 1 })
      .expect(201);

    expect(oidc.authenticate).toHaveBeenCalledWith('github-actions-oidc-token');
    expect(machines.provision).toHaveBeenCalledWith(
      'production-release-33773656386-1',
      1,
      expect.objectContaining({
        companyId,
        roles: ['DEPLOYMENT_PROVISIONER'],
        actorType: 'GitHubActionsOIDC',
        requestId: '50000000-0000-4000-8000-000000000001',
      }),
    );
    expect(response.body.data).toMatchObject({ clientId: identityId, credentialId, companyId });
  });
});
