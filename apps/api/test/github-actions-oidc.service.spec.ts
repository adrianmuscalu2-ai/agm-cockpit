import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../src/machine-auth/github-actions-oidc.contract';
import { GitHubActionsOidcService } from '../src/machine-auth/github-actions-oidc.service';

const revision = 'a'.repeat(40);
const companyId = GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId;
const keyId = 'github-actions-test-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: keyId,
  alg: 'RS256',
  use: 'sig',
};

function harness(options: { configuredRevision?: string; company?: { id: string } | null } = {}) {
  const prisma = {
    company: {
      findFirst: jest.fn().mockResolvedValue(options.company === undefined ? { id: companyId } : options.company),
    },
  };
  const verifier = new JwtService();
  const config = new ConfigService({ AGM_REVISION: options.configuredRevision ?? revision });
  return { service: new GitHubActionsOidcService(prisma as never, verifier, config), prisma };
}

async function token(overrides: Record<string, unknown> = {}) {
  const policy = GITHUB_ACTIONS_PROVISIONING_CONTRACT;
  const now = Math.floor(Date.now() / 1_000);
  return new JwtService().signAsync({
    sub: policy.subject,
    repository: policy.repository,
    repository_id: policy.repositoryId,
    repository_owner_id: policy.repositoryOwnerId,
    environment: policy.environment,
    ref: policy.ref,
    sha: revision,
    workflow_ref: policy.workflowRef,
    event_name: policy.eventName,
    runner_environment: policy.runnerEnvironment,
    run_id: '33773656386',
    run_attempt: '1',
    jti: '00000000-0000-4000-8000-000000000001',
    iat: now,
    exp: now + 300,
    ...overrides,
  }, {
    privateKey: privatePem,
    algorithm: 'RS256',
    keyid: keyId,
    issuer: policy.issuer,
    audience: policy.audience,
  });
}

async function tokenWithKeyId(kid: string) {
  const policy = GITHUB_ACTIONS_PROVISIONING_CONTRACT;
  const now = Math.floor(Date.now() / 1_000);
  return new JwtService().signAsync({
    sub: policy.subject,
    repository: policy.repository,
    repository_id: policy.repositoryId,
    repository_owner_id: policy.repositoryOwnerId,
    environment: policy.environment,
    ref: policy.ref,
    sha: revision,
    workflow_ref: policy.workflowRef,
    event_name: policy.eventName,
    runner_environment: policy.runnerEnvironment,
    run_id: '33773656386',
    run_attempt: '1',
    jti: '00000000-0000-4000-8000-000000000001',
    iat: now,
    exp: now + 300,
  }, {
    privateKey: privatePem,
    algorithm: 'RS256',
    keyid: kid,
    issuer: policy.issuer,
    audience: policy.audience,
  });
}

describe('GitHub Actions OIDC Production provisioning boundary', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('accepts only the pinned Production workflow and binds it to the deployed revision and tenant', async () => {
    const { service, prisma } = harness();
    await expect(service.authenticate(await token())).resolves.toMatchObject({
      userId: 'github-actions-oidc',
      companyId,
      roles: ['DEPLOYMENT_PROVISIONER'],
      actorType: 'GitHubActionsOIDC',
      actorSubject: GITHUB_ACTIONS_PROVISIONING_CONTRACT.subject,
      actorMetadata: {
        repository: GITHUB_ACTIONS_PROVISIONING_CONTRACT.repository,
        sha: revision,
        runId: '33773656386',
      },
    });
    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: companyId, isActive: true }),
      select: { id: true },
    });
    const lookup = prisma.company.findFirst.mock.calls[0][0];
    expect(lookup.where.users.some.roles.some.role.code.in).toContain('company_owner');
  });

  it('caches a validated signing key only within the bounded JWKS cache window', async () => {
    const { service } = harness();
    await service.authenticate(await token({ jti: '00000000-0000-4000-8000-000000000001' }));
    await service.authenticate(await token({ jti: '00000000-0000-4000-8000-000000000002' }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch the trusted key set for repeated unknown key identifiers', async () => {
    const { service } = harness();
    await expect(service.authenticate(await tokenWithKeyId('unknown-one'))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.authenticate(await tokenWithKeyId('unknown-two'))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['repository', 'attacker/fork'],
    ['environment', 'Development'],
    ['ref', 'refs/heads/main'],
    ['workflow_ref', 'adrianmuscalu2-ai/agm-cockpit/.github/workflows/other.yml@refs/heads/agm-canonical-20260820'],
    ['sha', 'b'.repeat(40)],
    ['runner_environment', 'self-hosted'],
  ])('rejects a token with a mismatched %s claim', async (claim, value) => {
    const { service } = harness();
    await expect(service.authenticate(await token({ [claim]: value }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a signed token whose lifetime exceeds the policy window', async () => {
    const now = Math.floor(Date.now() / 1_000);
    const { service } = harness();
    await expect(service.authenticate(await token({ iat: now, exp: now + 601 }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when the deployed revision binding is missing', async () => {
    const { service } = harness({ configuredRevision: '' });
    await expect(service.authenticate(await token())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when the canonical provisioning tenant is unavailable', async () => {
    const { service } = harness({ company: null });
    await expect(service.authenticate(await token())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when GitHub signing keys are unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network unavailable'));
    const { service } = harness();
    await expect(service.authenticate(await token())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
