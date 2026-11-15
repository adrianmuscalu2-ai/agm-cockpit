import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { CopilotOutcome, CopilotUsage } from './agmatcc-copilot.contract';

export type AcpmEvaluationEvent = {
  schema: 'acpm-isolated-evaluation.v1';
  eventId: string;
  executionId: string;
  testMandateId: string;
  provider: 'simulated' | 'openai';
  model: string;
  outcome: CopilotOutcome;
  startedAt: string;
  totalMs: number;
  timeToFirstResponseMs: number;
  usage: CopilotUsage;
  retryCount: 0;
  errorCode: string | null;
  timedOut: boolean;
  evidenceRefs: string[];
  previousHash: string;
  eventHash: string;
};

/** Append-only evaluation spool; it is deliberately independent from Prisma and Production journals. */
export class AcpmIsolatedSpool {
  private static readonly queues = new Map<string, Promise<void>>();
  private get queue() { return AcpmIsolatedSpool.queues.get(this.filePath) ?? Promise.resolve(); }
  private set queue(value: Promise<void>) { AcpmIsolatedSpool.queues.set(this.filePath, value); }
  private readonly filePath: string;

  constructor(directory = process.env.ACPM_ISOLATED_SPOOL_DIR) {
    if (process.env.NODE_ENV === 'production') throw new Error('ACPM_ISOLATED_SPOOL_PRODUCTION_DISABLED');
    if (!directory?.trim()) throw new Error('ACPM_ISOLATED_SPOOL_DIR_REQUIRED');
    this.filePath = resolve(directory, 'evaluations.v1.jsonl');
  }

  async append(input: Omit<AcpmEvaluationEvent, 'schema' | 'eventId' | 'previousHash' | 'eventHash'>) {
    const appendTask = this.queue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const entries = await this.readAll();
      const previousHash = entries.at(-1)?.eventHash ?? 'GENESIS';
      const body = { ...input, schema: 'acpm-isolated-evaluation.v1' as const, eventId: randomUUID(), previousHash };
      const event = { ...body, eventHash: hash(body) } satisfies AcpmEvaluationEvent;
      await appendFile(this.filePath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', flag: 'a' });
      return event;
    });
    this.queue = appendTask.then(() => undefined, () => undefined);
    return appendTask;
  }

  async verify() {
    await this.queue;
    const entries = await this.readAll();
    let previousHash = 'GENESIS';
    for (const [index, event] of entries.entries()) {
      const { eventHash, ...body } = event;
      if (event.previousHash !== previousHash || eventHash !== hash(body)) return { valid: false, count: entries.length, brokenAt: index, lastHash: previousHash };
      previousHash = eventHash;
    }
    return { valid: true, count: entries.length, brokenAt: null, lastHash: previousHash };
  }

  private async readAll(): Promise<AcpmEvaluationEvent[]> {
    let source: string;
    try { source = await readFile(this.filePath, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    const lines = source.split(/\r?\n/).filter(Boolean);
    return lines.map((line) => JSON.parse(line) as AcpmEvaluationEvent);
  }
}

function hash(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
