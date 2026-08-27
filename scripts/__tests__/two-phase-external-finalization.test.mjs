import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTwoPhaseExternalFinalization as validate } from '../validate-two-phase-external-finalization-contract.mjs';

const h = 'a'.repeat(64);
const valid = () => ({
  closureIntent:{contract:'agm-instrumentation-lifecycle-closure-intent.v1',atomicPublication:true,runner:{pid:42,identitySha256:h},windowSha256:h,windowHashMatches:true},
  runner:{presentBeforeExit:true,stateAfterWait:'ABSENT',exitVerifiedAt:200},
  finalizer:{contract:'agm-instrumentation-external-finalizer-identity.v1',role:'EXTERNAL_FINALIZER',identitySha256:h,genericObserverFiltering:false,verdictPublished:true,exitsAfterPublication:true},
  inventory:{contract:'agm-instrumentation-lifecycle-process-inventory.v2',phase:'AFTER_SHUTDOWN',capturedAt:201,externalFinalizerIdentitySha256:h,managedMatches:0,descendantMatches:0,orphans:0,agmProcessesRemaining:0},
  analyzer:{schemaValid:true,verdict:'PASS'}, manifest:{hashesVerified:true,canonicalInventories:true}, boundary:{atomic:true},
});
const mutate = (fn) => { const value=valid(); fn(value); return validate(value); };
const has = (result, code) => assert.ok(result.findings.includes(code), `${code}: ${result.findings}`);

test('valid two-phase protocol passes',()=>assert.equal(validate(valid()).verdict,'PASS'));
test('runner is present before exit',()=>has(mutate(x=>x.runner.presentBeforeExit=false),'RUNNER_NOT_PROVEN_PRESENT_BEFORE_EXIT'));
test('runner is absent after exit',()=>assert.equal(validate(valid()).findings.length,0));
test('PID reuse with different identity fails',()=>has(mutate(x=>x.runner.stateAfterWait='PRESENT_DIFFERENT_IDENTITY'),'RUNNER_PID_REUSED'));
test('runner that does not exit fails',()=>has(mutate(x=>x.runner.stateAfterWait='PRESENT_SAME_IDENTITY'),'RUNNER_DID_NOT_EXIT'));
test('finalizer inventory started too early fails',()=>has(mutate(x=>x.inventory.capturedAt=199),'FINAL_INVENTORY_CAPTURED_BEFORE_RUNNER_EXIT'));
test('missing closure intent fails',()=>has(mutate(x=>delete x.closureIntent),'CLOSURE_INTENT_MISSING_OR_INVALID'));
test('incomplete or mismatched window hash fails',()=>has(mutate(x=>x.closureIntent.windowHashMatches=false),'WINDOW_HASH_INVALID'));
test('inventory captured before exit fails',()=>has(mutate(x=>x.inventory.capturedAt=100),'FINAL_INVENTORY_CAPTURED_BEFORE_RUNNER_EXIT'));
test('valid inventory after exit passes',()=>assert.equal(validate(valid()).verdict,'PASS'));
test('real zero-orphan violation fails',()=>has(mutate(x=>x.inventory.orphans=1),'ZERO_ORPHAN_CLOSURE_NOT_PROVEN'));
test('remaining AGM process fails',()=>has(mutate(x=>x.inventory.agmProcessesRemaining=1),'AGM_PROCESS_REMAINING'));
test('finalizer must stop after verdict publication',()=>has(mutate(x=>x.finalizer.exitsAfterPublication=false),'FINALIZER_DID_NOT_EXIT_AFTER_VERDICT'));
test('finalizer is exact and never generically filtered',()=>has(mutate(x=>x.finalizer.genericObserverFiltering=true),'FINALIZER_IDENTITY_OR_TREATMENT_INVALID'));

test('current sources encode external phase ordering and no runner final inventory', async()=>{
  const [runner,finalizer,inventory,analyzer]=await Promise.all([
    readFile(new URL('../Invoke-InstrumentationLifecycleClosure.ps1',import.meta.url),'utf8'),
    readFile(new URL('../Invoke-InstrumentationLifecycleExternalFinalizer.ps1',import.meta.url),'utf8'),
    readFile(new URL('../Get-InstrumentationLifecycleProcessInventory.ps1',import.meta.url),'utf8'),
    readFile(new URL('../analyze-instrumentation-lifecycle-cycle.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(runner,/shutdown\.v3/); assert.match(runner,/closure-intent\.json/); assert.match(runner,/Publish-JsonEvidenceAtomic -Value \$closureIntent/);
  assert.doesNotMatch(runner,/-Phase 'AFTER_SHUTDOWN'/);
  assert.match(finalizer,/RUNNER_PID_REUSED_WITH_DIFFERENT_IDENTITY/); assert.match(finalizer,/RUNNER_DID_NOT_EXIT_BEFORE_FINALIZATION/);
  assert.match(finalizer,/runnerExitedAt[\s\S]*?-Phase AFTER_SHUTDOWN/); assert.match(finalizer,/--verify/);
  assert.match(inventory,/DECLARED_CONTROL_PROCESS \/ NOT_A_MANAGED_AGM_PROCESS \/ EXACT_IDENTITY_ONLY/);
  assert.match(analyzer,/SHUTDOWN_V3_EXTERNAL_FINALIZATION_INVALID/);
});
