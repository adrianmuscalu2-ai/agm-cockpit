import { AcpmIsolatedSpool } from '../src/agmatcc-copilot/acpm-isolated-spool';

const spool = new AcpmIsolatedSpool('D:/AGM-ACPM-Isolated-20261115-GPT6Luna');
const mode = process.argv[2];

async function run() {
  if (mode === 'append') {
    const before = await spool.verify();
    if (!before.valid || before.count !== 0) throw new Error('LOCAL_SPOOL_TEST_REQUIRES_EMPTY_VALID_SPOOL');
    const event = await spool.append({
      executionId: 'local-persistence-proof',
      testMandateId: 'local-persistence-check',
      provider: 'simulated',
      model: 'gpt-6-luna',
      outcome: 'UNKNOWN',
      startedAt: new Date().toISOString(),
      totalMs: 0,
      timeToFirstResponseMs: 0,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      retryCount: 0,
      errorCode: 'LOCAL_SPOOL_RESTART_TEST_ONLY',
      timedOut: false,
      evidenceRefs: ['local-test:acpm-spool-restart'],
    });
    console.log(JSON.stringify({ operation: 'append-explicit-local-test-record', count: 1, provider: event.provider, outcome: event.outcome, eventHash: event.eventHash }));
    return;
  }
  if (mode === 'verify') {
    console.log(JSON.stringify({ operation: 'new-process-restart-verification', ...(await spool.verify()) }));
    return;
  }
  throw new Error('USAGE: acpm-spool-restart-proof.ts append|verify');
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'LOCAL_SPOOL_PROOF_FAILED');
  process.exitCode = 1;
});
