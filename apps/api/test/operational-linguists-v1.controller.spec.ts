import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../src/machine-auth/github-actions-oidc.contract';
import { GitHubActionsOidcGuard } from '../src/machine-auth/github-actions-oidc.guard';
import { GitHubActionsOidcService } from '../src/machine-auth/github-actions-oidc.service';
import { OperationalLinguistsV1Controller } from '../src/operational-linguists-v1/operational-linguists-v1.controller';
import { OperationalLinguistsV1Service } from '../src/operational-linguists-v1/operational-linguists-v1.service';
import { TurnAdminService } from '../src/turn-admin/turn-admin.service';

describe('Operational Linguist V1 HTTP authority boundary', () => {
  let app: INestApplication;
  const actor = {
    userId: 'github-actions-oidc', companyId: GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId,
    roles: ['DEPLOYMENT_PROVISIONER'], requestId: '', correlationId: '', actorType: 'GitHubActionsOIDC',
    actorSubject: GITHUB_ACTIONS_PROVISIONING_CONTRACT.subject,
    actorMetadata: { sha: 'a'.repeat(40), workflowRef: GITHUB_ACTIONS_PROVISIONING_CONTRACT.workflowRef, runId: '100', runAttempt: '1' },
  };
  const oidc = {
    authenticate: jest.fn(async (token: string) => {
      if (token !== 'verified-oidc-token') throw new UnauthorizedException();
      return actor;
    }),
  };
  const linguists = {
    registerPublisher: jest.fn(async () => ({ registrationId: '11111111-1111-4111-8111-111111111111' })),
    heartbeat: jest.fn(),
    activate: jest.fn(),
    state: jest.fn(async () => ({ status: 'ACTIVE', components: [] })),
  };
  const turnAdmin = {
    requireOperationalAccess: jest.fn(async (authorization?: string) => {
      if (authorization !== 'Bearer verified-owner-session') throw new UnauthorizedException();
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OperationalLinguistsV1Controller],
      providers: [
        GitHubActionsOidcGuard,
        { provide: GitHubActionsOidcService, useValue: oidc },
        { provide: OperationalLinguistsV1Service, useValue: linguists },
        { provide: TurnAdminService, useValue: turnAdmin },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('rejects missing and invalid OIDC credentials before publisher registration', async () => {
    await request(app.getHttpServer()).post('/api/v1/operations/turn/operational-linguists/publishers').expect(401);
    await request(app.getHttpServer()).post('/api/v1/operations/turn/operational-linguists/publishers').set('Authorization', 'Bearer invalid-token').expect(401);
    expect(linguists.registerPublisher).not.toHaveBeenCalled();
  });

  it('passes only the server-verified OIDC actor to publisher registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/operations/turn/operational-linguists/publishers')
      .set('Authorization', 'Bearer verified-oidc-token')
      .expect(201);
    expect(linguists.registerPublisher).toHaveBeenCalledWith(expect.objectContaining({
      companyId: GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId,
      roles: ['DEPLOYMENT_PROVISIONER'],
      actorType: 'GitHubActionsOIDC',
    }));
  });

  it('rejects the wrong TURN authority for state and permits a verified Owner session', async () => {
    await request(app.getHttpServer()).get('/api/v1/operations/turn/operational-linguists/state').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/operations/turn/operational-linguists/state')
      .set('Authorization', 'Bearer wrong-authority')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/operations/turn/operational-linguists/state')
      .set('Authorization', 'Bearer verified-owner-session')
      .expect(200);
    expect(linguists.state).toHaveBeenCalledWith(GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId);
  });
});
