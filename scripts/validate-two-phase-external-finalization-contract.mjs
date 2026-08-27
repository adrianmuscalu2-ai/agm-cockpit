import process from 'node:process';
import { readFile } from 'node:fs/promises';

export function validateTwoPhaseExternalFinalization(model) {
  const findings = [];
  const fail = (code) => findings.push(code);
  const intent = model?.closureIntent;
  if (!intent || intent.contract !== 'agm-instrumentation-lifecycle-closure-intent.v1') fail('CLOSURE_INTENT_MISSING_OR_INVALID');
  if (!intent?.atomicPublication) fail('CLOSURE_INTENT_NOT_ATOMIC');
  if (!Number.isSafeInteger(intent?.runner?.pid) || !/^[0-9a-f]{64}$/.test(String(intent?.runner?.identitySha256 ?? ''))) fail('RUNNER_IDENTITY_INVALID');
  if (!/^[0-9a-f]{64}$/.test(String(intent?.windowSha256 ?? '')) || intent?.windowHashMatches !== true) fail('WINDOW_HASH_INVALID');
  if (model?.runner?.presentBeforeExit !== true) fail('RUNNER_NOT_PROVEN_PRESENT_BEFORE_EXIT');
  if (model?.runner?.stateAfterWait === 'PRESENT_SAME_IDENTITY') fail('RUNNER_DID_NOT_EXIT');
  else if (model?.runner?.stateAfterWait === 'PRESENT_DIFFERENT_IDENTITY') fail('RUNNER_PID_REUSED');
  else if (model?.runner?.stateAfterWait !== 'ABSENT') fail('RUNNER_EXIT_STATE_INVALID');
  if (model?.runner?.exitVerifiedAt == null) fail('RUNNER_EXIT_NOT_VERIFIED');
  if (model?.finalizer?.contract !== 'agm-instrumentation-external-finalizer-identity.v1'
    || model?.finalizer?.role !== 'EXTERNAL_FINALIZER' || !/^[0-9a-f]{64}$/.test(String(model?.finalizer?.identitySha256 ?? ''))
    || model?.finalizer?.genericObserverFiltering !== false) fail('FINALIZER_IDENTITY_OR_TREATMENT_INVALID');
  if (!(Number(model?.inventory?.capturedAt) >= Number(model?.runner?.exitVerifiedAt))) fail('FINAL_INVENTORY_CAPTURED_BEFORE_RUNNER_EXIT');
  if (model?.inventory?.contract !== 'agm-instrumentation-lifecycle-process-inventory.v2'
    || model?.inventory?.phase !== 'AFTER_SHUTDOWN') fail('CANONICAL_FINAL_INVENTORY_INVALID');
  if (model?.inventory?.externalFinalizerIdentitySha256 !== model?.finalizer?.identitySha256) fail('FINALIZER_NOT_EXPLICITLY_DECLARED_IN_INVENTORY');
  if (model?.inventory?.managedMatches !== 0 || model?.inventory?.descendantMatches !== 0 || model?.inventory?.orphans !== 0) fail('ZERO_ORPHAN_CLOSURE_NOT_PROVEN');
  if (model?.inventory?.agmProcessesRemaining !== 0) fail('AGM_PROCESS_REMAINING');
  if (model?.analyzer?.schemaValid !== true || model?.analyzer?.verdict !== 'PASS') fail('FINAL_ANALYZER_INVALID');
  if (model?.manifest?.hashesVerified !== true || model?.manifest?.canonicalInventories !== true) fail('FINAL_MANIFEST_INVALID');
  if (model?.boundary?.atomic !== true) fail('BOUNDARY_NOT_ATOMIC');
  if (model?.finalizer?.verdictPublished !== true || model?.finalizer?.exitsAfterPublication !== true) fail('FINALIZER_DID_NOT_EXIT_AFTER_VERDICT');
  return { verdict: findings.length ? 'FAIL' : 'PASS', findings };
}

if (process.argv[1]?.endsWith('validate-two-phase-external-finalization-contract.mjs') && process.argv[2]) {
  const result = validateTwoPhaseExternalFinalization(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== 'PASS') process.exitCode = 2;
}
