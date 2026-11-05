import { ConfigService } from '@nestjs/config';
import type { DiscoveryService } from '@nestjs/core';
import type { PrismaClient } from '@prisma/client';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
import { SecretTelemetryService } from '../src/secret-telemetry/secret-telemetry.service';
import type { PrismaService } from '../src/prisma/prisma.service';

// Wires the real service graph for DB gate scripts. Discovery lists only the provider instances the script passes in,
// so runtime-capability probes see exactly what was constructed and nothing is fabricated.
export function createAuthorityControlPlaneForDbGate(prisma: PrismaClient, providers: readonly unknown[] = []) {
  const discovery = { getProviders: () => providers.map((instance) => ({ instance })) } as unknown as DiscoveryService;
  const secrets = new SecretTelemetryService(new ConfigService());
  const duties = new OperationalAgentDutyRunner(prisma as unknown as PrismaService, secrets, discovery);
  return new AuthorityControlPlaneService(prisma as unknown as PrismaService, secrets, discovery, duties);
}
