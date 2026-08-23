import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type InspectorExecutionContext = Readonly<{
  mandateId: string;
  agentId: 'agent-inspector';
  dossierId: string;
  evidenceRef: string;
  evidenceRoot: string;
  outputRoot: string;
  capabilities: readonly ['evidence:read'];
  tools: readonly ['filesystem:read'];
  onLifecycle?: (event: InspectorLifecycle) => void;
  now?: () => Date;
}>;

export type InspectorLifecycle = Readonly<{
  eventId: string;
  eventType: 'STARTED' | 'WORKING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  mandateId: string;
  agentId: 'agent-inspector';
  dossierId: string;
  evidenceRef: string;
  outputRef?: string;
  occurredAt: string;
  evidenceHash?: string;
  detail: string;
}>;

export type InspectorExecutionResult = Readonly<{
  verdict: 'PASS' | 'FAIL' | 'BLOCKED';
  mandateId: string;
  agentId: 'agent-inspector';
  evidenceRef: string;
  outputRef: string;
  evidenceHash: string;
  outputHash: string;
  lifecycle: readonly InspectorLifecycle[];
}>;

export async function executeAgentInspector(input: InspectorExecutionContext): Promise<InspectorExecutionResult> {
  const now = input.now ?? (() => new Date());
  const lifecycle: InspectorLifecycle[] = [];
  const emit = (eventType: InspectorLifecycle['eventType'], detail: string, extra: Partial<InspectorLifecycle> = {}) => {
    const event = { eventId: `agent-event-${randomUUID()}`, eventType, mandateId: input.mandateId, agentId: input.agentId, dossierId: input.dossierId, evidenceRef: input.evidenceRef, occurredAt: now().toISOString(), detail, ...extra } as InspectorLifecycle;
    lifecycle.push(event);
    input.onLifecycle?.(event);
  };
  emit('STARTED', 'Inspector execution admitted.');
  try {
    if (input.capabilities.join(',') !== 'evidence:read' || input.tools.join(',') !== 'filesystem:read') throw new Error('INSPECTOR_CAPABILITY_DENIED');
    const source = resolve(input.evidenceRoot, input.evidenceRef);
    const root = resolve(input.evidenceRoot);
    const relativeSource = relative(root, source);
    if (relativeSource === '..' || relativeSource.startsWith(`..${sep}`) || isAbsolute(relativeSource)) {
      throw new Error('EVIDENCE_REF_OUTSIDE_ROOT');
    }
    emit('WORKING', 'Reading and validating evidence reference.');
    const content = await readFile(source, 'utf8');
    const evidenceHash = createHash('sha256').update(content).digest('hex');
    const verdict: InspectorExecutionResult['verdict'] = content.trim().length > 0 ? 'PASS' : 'FAIL';
    const report = { schemaVersion: 'agm.agent-inspection.v1', mandateId: input.mandateId, agentId: input.agentId, dossierId: input.dossierId, evidenceRef: input.evidenceRef, evidenceHash, verdict, inspectedAt: now().toISOString(), checks: [{ id: 'EVIDENCE_PRESENT', result: content.trim().length > 0 ? 'PASS' : 'FAIL' }] };
    const outputRef = resolve(input.outputRoot, `${input.mandateId}-${input.agentId}-report.json`);
    await mkdir(input.outputRoot, { recursive: true });
    await writeFile(outputRef, JSON.stringify(report, null, 2), 'utf8');
    const outputHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    emit('COMPLETED', `Inspection completed with verdict ${verdict}.`, { outputRef, evidenceHash });
    return { verdict, mandateId: input.mandateId, agentId: input.agentId, evidenceRef: input.evidenceRef, outputRef, evidenceHash, outputHash, lifecycle };
  } catch (error) {
    emit(error instanceof Error && /CAPABILITY|OUTSIDE/.test(error.message) ? 'BLOCKED' : 'FAILED', error instanceof Error ? error.message : 'INSPECTOR_EXECUTION_FAILED');
    throw error;
  }
}

export const executableAgentRegistry = Object.freeze(new Map([['agent-inspector', executeAgentInspector] as const]));
