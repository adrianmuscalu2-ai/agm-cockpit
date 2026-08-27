import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import process from 'node:process';

export const SCHEMA = JSON.parse(await readFile(new URL('../config/copilot-v1.2/instrumentation-closure-intent.schema.json', import.meta.url), 'utf8'));
export const CONTRACT = SCHEMA.$id;
const hex = /^[0-9a-f]{64}$/;
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const safeRelative = (v) => nonempty(v) && !isAbsolute(v) && !v.includes('..') && !v.startsWith('.') && !v.includes('//') && !v.includes('\\\\');
const signatureShape = (v) => v && safeRelative(v.path) && Number.isSafeInteger(v.bytes) && v.bytes > 0 && hex.test(v.sha256);
const within = (base, target) => { const b=resolve(base).toLowerCase(); const t=resolve(target).toLowerCase(); return t === b || t.startsWith(`${b}\\`) || t.startsWith(`${b}/`); };

export async function validateClosureIntent(intent, { workspaceRoot, outputRoot, verifyFiles = true } = {}) {
  const findings=[]; const fail=(code)=>findings.push(code);
  if (!intent || intent.contract !== CONTRACT || intent.contractVersion !== SCHEMA.properties.contractVersion.const) fail('CONTRACT_VERSION_INCOMPATIBLE');
  if (!nonempty(intent?.publishedAt) || !Number.isFinite(Date.parse(intent.publishedAt))) fail('TIMESTAMP_INVALID');
  if (intent?.publication?.atomic !== true || intent?.publication?.overwriteForbidden !== true) fail('PUBLICATION_NOT_ATOMIC');
  if (!nonempty(intent?.runId) || intent?.phase !== 'RUNNER_CLEANUP_COMPLETE_PENDING_EXTERNAL_FINALIZATION') fail('RUN_BINDING_INVALID');
  if (!Number.isSafeInteger(intent?.runner?.pid) || intent.runner.pid < 1 || !hex.test(String(intent?.runner?.identitySha256 ?? '')) || !Number.isSafeInteger(intent?.runner?.creationEpochMs) || !nonempty(intent?.runner?.imageName)) fail('RUNNER_IDENTITY_INVALID');
  if (intent?.windowIdentity?.runId !== intent?.runId || intent?.windowIdentity?.windowId !== intent?.runId || !signatureShape(intent?.windowIdentity?.signature)) fail('WINDOW_IDENTITY_INVALID');
  if (intent?.manifestReference?.pathBase !== 'OUTPUT_ROOT' || intent?.manifestReference?.path !== 'SHA256SUMS.json' || intent?.manifestReference?.hashAlgorithm !== 'SHA256' || intent?.manifestReference?.immutableAfterHash !== true) fail('MANIFEST_REFERENCE_INVALID');
  for (const name of ['shutdown','managedRoots','priorInventory','knownProtectedBackground']) if (!signatureShape(intent?.inputs?.[name])) fail(`INPUT_SIGNATURE_INVALID_${name}`);
  const outputs=intent?.outputs ?? {}; if (outputs.finalInventory !== 'process-inventory-after.json' || outputs.analysis !== 'instrumentation-lifecycle-analysis.json' || outputs.verdict !== 'external-finalizer-verdict.json' || outputs.finalizerLifecycle !== 'external-finalizer-lifecycle.json') fail('OUTPUT_PATHS_INVALID');
  const source=intent?.externalFinalizerSource;
  if (!source || source.pathBase !== 'WORKSPACE_ROOT' || !signatureShape(source)) fail('EXTERNAL_FINALIZER_SOURCE_INVALID');
  if (intent?.runnerMustExitBeforeFinalInventory !== true || intent?.finalizerMustDeclareExactIdentity !== true) fail('FINALIZATION_POLICY_INVALID');
  if (verifyFiles && workspaceRoot && outputRoot && findings.length === 0) {
    const checks=[
      [intent.windowIdentity.signature, outputRoot], [intent.inputs.shutdown,outputRoot], [intent.inputs.managedRoots,outputRoot],
      [intent.inputs.priorInventory,outputRoot], [intent.inputs.knownProtectedBackground,outputRoot], [source,workspaceRoot],
    ];
    for (const [sig,base] of checks) {
      if (isAbsolute(sig.path)) { fail('ABSOLUTE_PATH_FORBIDDEN'); continue; }
      const target=resolve(base,sig.path); if(!within(base,target)){fail('PATH_ESCAPE_FORBIDDEN');continue;}
      try { const [bytes,info]=await Promise.all([readFile(target),stat(target)]); const digest=createHash('sha256').update(bytes).digest('hex'); if(!info.isFile()||info.size!==sig.bytes||digest!==sig.sha256) fail(`SIGNATURE_MISMATCH_${basename(sig.path)}`); }
      catch { fail(`SIGNED_FILE_MISSING_${basename(sig.path)}`); }
    }
  }
  return { valid: findings.length === 0, contract: intent?.contract ?? null, findings };
}

if (process.argv[1]?.endsWith('closure-intent-contract.mjs')) {
  const [file,workspaceRoot,outputRoot]=process.argv.slice(2); if(!file) throw new Error('CLOSURE_INTENT_PATH_REQUIRED');
  const intent=JSON.parse(await readFile(file,'utf8')); const result=await validateClosureIntent(intent,{workspaceRoot,outputRoot,verifyFiles:true});
  console.log(JSON.stringify(result)); if(!result.valid) process.exitCode=2;
}
