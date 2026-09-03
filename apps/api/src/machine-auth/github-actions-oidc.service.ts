import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createPublicKey, type JsonWebKey as CryptoJsonWebKey } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MACHINE_AUTH_CONTRACT } from './machine-auth.contract';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT, type GitHubActionsOidcClaims } from './github-actions-oidc.contract';

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string; kty?: string };
type JwksDocument = { keys?: Jwk[] };

@Injectable()
export class GitHubActionsOidcService {
  private readonly keys = new Map<string, { pem: string; expiresAt: number }>();
  private keySetExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async authenticate(token: string) {
    const header = decodeProtectedHeader(token);
    const pem = await this.signingKey(header.kid);
    let claims: GitHubActionsOidcClaims;
    try {
      claims = await this.jwt.verifyAsync<GitHubActionsOidcClaims>(token, {
        secret: pem,
        algorithms: ['RS256'],
        issuer: GITHUB_ACTIONS_PROVISIONING_CONTRACT.issuer,
        audience: GITHUB_ACTIONS_PROVISIONING_CONTRACT.audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid GitHub Actions OIDC token.');
    }
    this.assertClaims(claims);
    const companyId = await this.resolveTenant();
    return {
      userId: 'github-actions-oidc',
      companyId,
      roles: [GITHUB_ACTIONS_PROVISIONING_CONTRACT.role],
      requestId: '',
      correlationId: '',
      actorType: 'GitHubActionsOIDC' as const,
      actorSubject: claims.sub,
      actorMetadata: {
        repository: claims.repository,
        workflowRef: claims.workflow_ref,
        ref: claims.ref,
        sha: claims.sha,
        runId: claims.run_id,
        runAttempt: claims.run_attempt,
        oidcJti: claims.jti,
      },
    };
  }

  private assertClaims(claims: GitHubActionsOidcClaims) {
    const expectedRevision = this.config.get<string>('AGM_REVISION');
    const policy = GITHUB_ACTIONS_PROVISIONING_CONTRACT;
    const now = Math.floor(Date.now() / 1_000);
    if (!expectedRevision || !/^[0-9a-f]{40}$/.test(expectedRevision)) throw new ServiceUnavailableException('Production revision binding is unavailable.');
    if (
      claims.sub !== policy.subject
      || claims.repository !== policy.repository
      || claims.repository_id !== policy.repositoryId
      || claims.repository_owner_id !== policy.repositoryOwnerId
      || claims.environment !== policy.environment
      || claims.ref !== policy.ref
      || claims.workflow_ref !== policy.workflowRef
      || claims.event_name !== policy.eventName
      || claims.runner_environment !== policy.runnerEnvironment
      || claims.sha !== expectedRevision
      || !/^\d+$/.test(claims.run_id)
      || !/^\d+$/.test(claims.run_attempt)
      || typeof claims.jti !== 'string'
      || claims.jti.length < 16
      || !Number.isInteger(claims.iat)
      || !Number.isInteger(claims.exp)
      || claims.iat > now + policy.clockToleranceSeconds
      || claims.iat < now - policy.maxTokenLifetimeSeconds
      || claims.exp <= claims.iat
      || claims.exp - claims.iat > policy.maxTokenLifetimeSeconds
    ) throw new UnauthorizedException('GitHub Actions OIDC claims do not match the Production provisioning policy.');
  }

  private async resolveTenant() {
    const companies = await this.prisma.company.findMany({
      where: {
        isActive: true,
        users: {
          some: {
            status: 'Active',
            roles: { some: { role: { isActive: true, code: { in: [...MACHINE_AUTH_CONTRACT.provisioningRoles] } } } },
          },
        },
      },
      select: { id: true },
      take: 2,
    });
    if (companies.length !== 1) throw new ServiceUnavailableException('Production provisioning tenant binding is ambiguous or unavailable.');
    return companies[0].id;
  }

  private async signingKey(kid: string) {
    const cached = this.keys.get(kid);
    if (cached && cached.expiresAt > Date.now()) return cached.pem;
    if (this.keySetExpiresAt > Date.now()) throw new UnauthorizedException('Unknown GitHub Actions OIDC signing key.');
    let response: Response;
    try {
      response = await fetch(GITHUB_ACTIONS_PROVISIONING_CONTRACT.jwksUri, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(GITHUB_ACTIONS_PROVISIONING_CONTRACT.jwksTimeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException('GitHub Actions OIDC signing keys are unavailable.');
    }
    if (!response.ok) throw new ServiceUnavailableException('GitHub Actions OIDC signing keys are unavailable.');
    const document = await response.json() as JwksDocument;
    const expiresAt = Date.now() + GITHUB_ACTIONS_PROVISIONING_CONTRACT.jwksCacheMs;
    let usableKeys = 0;
    for (const jwk of document.keys ?? []) {
      if (!jwk.kid || jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig') continue;
      try {
        const pem = createPublicKey({ key: jwk as unknown as CryptoJsonWebKey, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString();
        this.keys.set(jwk.kid, { pem, expiresAt });
        usableKeys += 1;
      } catch {
        continue;
      }
    }
    if (usableKeys === 0) throw new ServiceUnavailableException('GitHub Actions OIDC signing keys are unavailable.');
    this.keySetExpiresAt = expiresAt;
    const selected = this.keys.get(kid);
    if (!selected) throw new UnauthorizedException('Unknown GitHub Actions OIDC signing key.');
    return selected.pem;
  }
}

function decodeProtectedHeader(token: string) {
  const segments = token.split('.');
  if (segments.length !== 3) throw new UnauthorizedException('Invalid GitHub Actions OIDC token.');
  try {
    const header = JSON.parse(Buffer.from(segments[0], 'base64url').toString('utf8')) as { alg?: string; typ?: string; kid?: string };
    if (header.alg !== 'RS256' || header.typ !== 'JWT' || !header.kid) throw new Error('invalid');
    return { kid: header.kid };
  } catch {
    throw new UnauthorizedException('Invalid GitHub Actions OIDC token.');
  }
}
