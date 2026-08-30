import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CANONICAL_BASELINE,
  type CanonicalAuthorityDomain,
  type CanonicalSource,
} from './canonical-authority.contract';

type RegistryDocument = { sources: CanonicalSource[] };
type ViewDocument = { sourceCount: number; centralRegistry: string; memberships: Array<{ membershipId: string; sourceId: string }> };

const REGISTRY_PATH = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const VIEW_PATHS: Record<CanonicalAuthorityDomain, string> = {
  ROUTING_TOLL: 'AGM_LIBRARY/VIEWS/routing-toll.view.json',
  LEGISLATION_SAFETY: 'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
};

@Injectable()
export class CanonicalAuthorityLoader {
  readonly workspaceRoot: string;
  readonly registryPath = REGISTRY_PATH;
  private readonly registry: RegistryDocument;
  private readonly views: Record<CanonicalAuthorityDomain, ViewDocument>;
  private readonly byId: Map<string, CanonicalSource>;
  private readonly membership: Record<CanonicalAuthorityDomain, Set<string>>;

  constructor(config: ConfigService) {
    this.workspaceRoot = discoverWorkspaceRoot(config.get<string>('AGM_CANONICAL_LIBRARY_ROOT'));
    const registry = this.readJson<RegistryDocument>(REGISTRY_PATH, CANONICAL_BASELINE.registry.sha256);
    const routing = this.readJson<ViewDocument>(VIEW_PATHS.ROUTING_TOLL, CANONICAL_BASELINE.routingToll.sha256);
    const legislation = this.readJson<ViewDocument>(VIEW_PATHS.LEGISLATION_SAFETY, CANONICAL_BASELINE.legislationSafety.sha256);
    assertCount('REGISTRY', registry.sources.length, CANONICAL_BASELINE.registry.count);
    assertCount('ROUTING_TOLL', routing.memberships.length, CANONICAL_BASELINE.routingToll.count);
    assertCount('LEGISLATION_SAFETY', legislation.memberships.length, CANONICAL_BASELINE.legislationSafety.count);
    this.registry = registry;
    this.views = { ROUTING_TOLL: routing, LEGISLATION_SAFETY: legislation };
    this.byId = new Map(registry.sources.map((source) => [source.sourceId, source]));
    if (this.byId.size !== registry.sources.length) throw new Error('CANONICAL_REGISTRY_DUPLICATE_SOURCE_ID');
    this.membership = {
      ROUTING_TOLL: membershipSet(routing, this.byId, 'ROUTING_TOLL'),
      LEGISLATION_SAFETY: membershipSet(legislation, this.byId, 'LEGISLATION_SAFETY'),
    };
  }

  source(sourceId: string) { return this.byId.get(sourceId); }
  sources() { return [...this.registry.sources]; }
  contains(domain: CanonicalAuthorityDomain, sourceId: string) { return this.membership[domain].has(sourceId); }
  viewPath(domain: CanonicalAuthorityDomain) { return VIEW_PATHS[domain]; }
  domainMemberships(domain: CanonicalAuthorityDomain) { return [...this.membership[domain]]; }
  absolutePath(relativePath: string) { return resolve(this.workspaceRoot, relativePath); }

  private readJson<T>(relativePath: string, expectedHash: string): T {
    const bytes = readFileSync(resolve(this.workspaceRoot, relativePath));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== expectedHash) throw new Error(`CANONICAL_BASELINE_HASH_MISMATCH:${relativePath}:${actualHash}`);
    return JSON.parse(bytes.toString('utf8')) as T;
  }
}

function discoverWorkspaceRoot(configured?: string) {
  const candidates = [
    configured ? (isAbsolute(configured) ? configured : resolve(process.cwd(), configured)) : null,
    process.cwd(),
    resolve(process.cwd(), '..', '..'),
    resolve(__dirname, '..', '..', '..', '..'),
  ].filter((value): value is string => Boolean(value));
  const root = candidates.find((candidate) => existsSync(resolve(candidate, REGISTRY_PATH)));
  if (!root) throw new Error('CANONICAL_LIBRARY_ROOT_NOT_FOUND');
  return root;
}

function assertCount(name: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`CANONICAL_${name}_COUNT_MISMATCH:${actual}:${expected}`);
}

function membershipSet(view: ViewDocument, sources: Map<string, CanonicalSource>, domain: string) {
  if (view.sourceCount !== view.memberships.length) throw new Error(`CANONICAL_${domain}_DECLARED_COUNT_MISMATCH`);
  const result = new Set<string>();
  for (const membership of view.memberships) {
    if (!sources.has(membership.sourceId)) throw new Error(`CANONICAL_${domain}_ORPHAN:${membership.sourceId}`);
    if (result.has(membership.sourceId)) throw new Error(`CANONICAL_${domain}_DUPLICATE_MEMBERSHIP:${membership.sourceId}`);
    result.add(membership.sourceId);
  }
  return result;
}
