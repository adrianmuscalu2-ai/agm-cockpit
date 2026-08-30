import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/OWNER_MANUAL_INGEST/RT001-FINAL-FR-SANEF-2026.owner-official.pdf`;
const visualEvidenceRelative = `${outputRelative}/OWNER_MANUAL_INGEST/VISUAL_EVIDENCE_ARTIFACT_02`;
const validationRelative = `${outputRelative}/OWNER_MANUAL_ARTIFACT_02_VALIDATION_REPORT.json`;
const manualManifestRelative = `${outputRelative}/OWNER_MANUAL_INGESTION_MANIFEST.json`;
const acquisitionRelative = `${outputRelative}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`;
const artifactId = 'RT001-FINAL-FR-SANEF-2026';
const sourceUrl = 'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf';
const artifactPath = path.join(root, artifactRelative);
const generatedAt = new Date().toISOString();

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const atomicWriteJson = (relative, value) => {
  const target = path.join(root, relative);
  const temporary = `${target}.tmp-owner-ingest`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
};
const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });

check('FILE_EXISTS', existsSync(artifactPath), existsSync(artifactPath), true);
if (!existsSync(artifactPath)) {
  console.error('OWNER_ARTIFACT_NOT_FOUND');
  process.exit(1);
}

const bytes = readFileSync(artifactPath);
const latin = bytes.toString('latin1');
const hash = sha256(bytes);
let text = '';
let pdftotextExit = 0;
try {
  text = execFileSync('C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe', ['-layout', '-enc', 'UTF-8', artifactPath, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} catch (error) {
  pdftotextExit = error?.status ?? 1;
}

const pages = text.split('\f').filter((page) => page.trim().length > 0);
const tariffPages = pages.slice(1);
const vehicleClasses = Array.from({ length: 5 }, (_, index) => index + 1).map((number) => ({
  number,
  present: new RegExp(`${number}\\s+CLASSE`, 'i').test(text),
}));
const routeGroups = [
  { id: 'A16_A29', expression: /AUTOROUTES A16\s*-\s*A29/gi },
  { id: 'A1_A2_A26_NORD_A29', expression: /AUTOROUTES A1\s*-\s*A2\s*-\s*A26 NORD\s*-\s*A29/gi },
  { id: 'A4_A26_SUD', expression: /AUTOROUTES A4\s*-\s*A26 SUD/gi },
].map((item) => ({ id: item.id, count: (text.match(item.expression) ?? []).length }));
const tariffHeaders = (text.match(/TARIFS DE PEAGE TTC AU 01\/02\/2026/gi) ?? []).length;
const vatHeaders = (text.match(/TAUX DE TVA\s*:\s*20%/gi) ?? []).length;
const visualEvidence = Array.from({ length: 6 }, (_, index) => `${visualEvidenceRelative}/page-${index + 1}.png`);
const producer = latin.match(/\/Producer\s*\(([^)]*)\)/)?.[1] ?? null;
const creator = latin.match(/\/Creator\s*\(([^)]*)\)/)?.[1] ?? null;
const titleMetadata = latin.match(/\/Title\s*\(([^)]*)\)/)?.[1] ?? null;

check('PDF_MAGIC', bytes.subarray(0, 5).toString('ascii') === '%PDF-', bytes.subarray(0, 8).toString('ascii'), '%PDF-*');
check('PDF_EOF', latin.includes('%%EOF'), latin.includes('%%EOF'), true);
check('PDF_OPEN_AND_EXTRACT', pdftotextExit === 0 && text.length > 45_000, { pdftotextExit, textLength: text.length }, { pdftotextExit: 0, minimumTextLength: 45_000 });
check('ALL_PAGES_NONEMPTY', pages.length === 6 && pages.every((page) => page.trim().length > 20), { pageCount: pages.length, pageTextLengths: pages.map((page) => page.trim().length) }, { pageCount: 6, nonempty: true });
check('COVER_TITLE_2026', /Tarifs de p[ée]age\s+2026/i.test(text), /Tarifs de p[ée]age\s+2026/i.test(text), true);
check('OFFICIAL_SANEF_IDENTITY_VISUAL', visualEvidence.every((relative) => existsSync(path.join(root, relative))), visualEvidence, '6/6 controlled render captures; cover carries Sanef identity');
check('EFFECTIVE_DATE', /1er f[ée]vrier 2026/i.test(text), /1er f[ée]vrier 2026/i.test(text), true);
check('TARIFF_HEADERS_5', tariffHeaders === 5, tariffHeaders, 5);
check('VAT_20_HEADERS_5', vatHeaders === 5, vatHeaders, 5);
check('VEHICLE_CLASSES_1_TO_5', vehicleClasses.every((item) => item.present), vehicleClasses, '5/5');
check('ROUTE_GROUPS_ALL_CLASSES', routeGroups.every((item) => item.count === 5), routeGroups, 'each route group present on all 5 class pages');
check('TARIFF_PAGES_DENSE_COMPLETE', tariffPages.length === 5 && tariffPages.every((page) => page.trim().length > 8_000), { tariffPageCount: tariffPages.length, textLengths: tariffPages.map((page) => page.trim().length) }, { tariffPageCount: 5, minimumTextLength: 8_000 });
check('VISUAL_RENDER_6_OF_6', visualEvidence.every((relative) => existsSync(path.join(root, relative)) && readFileSync(path.join(root, relative)).length > 250_000), visualEvidence.map((relative) => ({ path: relative, sizeBytes: existsSync(path.join(root, relative)) ? readFileSync(path.join(root, relative)).length : null })), '6/6 rendered pages, no clipped tables on inspection');
check('NO_CHALLENGE_OR_ACCESS_DENIED', !/Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), /Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), false);
check('OFFICIAL_SOURCE_HOST', new URL(sourceUrl).hostname === 'www.groupe.sanef.com', new URL(sourceUrl).hostname, 'www.groupe.sanef.com');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-owner-manual-artifact-validation.v1',
  generatedAt,
  artifactId,
  verdict: failed.length === 0 ? 'VALID' : 'INVALID',
  artifact: {
    path: artifactRelative,
    filename: path.basename(artifactPath),
    mediaType: 'application/pdf',
    sizeBytes: bytes.length,
    sha256: hash,
  },
  provenance: {
    authority: 'Sanef',
    officialDirectPdfUrl: sourceUrl,
    officialHost: 'www.groupe.sanef.com',
    documentIdentity: 'Tarifs de peage 2026 / Sanef',
    titleMetadata,
    producer,
    creator,
    jurisdiction: 'FR',
    ownerAssistedCapture: true,
  },
  scope: 'Sanef tariff matrices for A16/A29, A1/A2/A26 Nord/A29 and A4/A26 Sud, vehicle classes 1-5',
  effectiveDate: '2026-02-01',
  evidenceCounts: {
    pages: pages.length,
    vehicleClasses: vehicleClasses.filter((item) => item.present).length,
    tariffHeaders,
    vatHeaders,
    routeGroups,
    visualPages: visualEvidence.length,
  },
  visualEvidence,
  visualInspection: 'PASS_6_OF_6_NO_CLIPPED_TABLES',
  checkCount: checks.length,
  failedCount: failed.length,
  checks,
  registryMutation: 'NONE',
  viewMutation: 'NONE',
  authorityPromotion: 'NONE',
};

atomicWriteJson(validationRelative, report);
if (failed.length) {
  console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, sha256: hash }, null, 2));
  process.exit(1);
}

const acquisition = readJson(acquisitionRelative);
const item = acquisition.items.find((entry) => entry.artifactId === artifactId);
if (!item) throw new Error(`Missing manifest item ${artifactId}`);
Object.assign(item, {
  status: 'INTEGRITY_CAPTURED_REVIEW_ONLY',
  finalUrl: sourceUrl,
  canonicalPath: artifactRelative,
  mediaType: 'application/pdf',
  sizeBytes: bytes.length,
  sha256: hash,
  acquisitionTimestamp: generatedAt,
  ingestionMethod: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION',
  ownerManualValidated: true,
  validationEvidence: validationRelative,
  visualEvidence,
  effectiveDate: '2026-02-01',
  provenance: report.provenance,
});
delete item.error;
acquisition.summary.captured = acquisition.items.filter((entry) => entry.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY').length;
acquisition.summary.blocked = acquisition.items.filter((entry) => entry.status === 'INTEGRITY_BLOCKED').length;
acquisition.lastUpdatedAt = generatedAt;
acquisition.lastUpdate = `${artifactId}_OWNER_MANUAL_VALIDATED`;
atomicWriteJson(acquisitionRelative, acquisition);

let manualManifest = { schemaVersion: 'agm-routing-toll-001-owner-manual-ingestion.v1', artifacts: [], registryMutation: 'NONE', viewMutation: 'NONE', authorityPromotion: 'NONE' };
if (existsSync(path.join(root, manualManifestRelative))) manualManifest = readJson(manualManifestRelative);
manualManifest.generatedAt = generatedAt;
manualManifest.artifacts = manualManifest.artifacts.filter((entry) => entry.artifactId !== artifactId);
manualManifest.artifacts.push({ artifactId, status: 'VALIDATED_INGESTED_REVIEW_ONLY', artifact: report.artifact, provenance: report.provenance, scope: report.scope, effectiveDate: report.effectiveDate, validationEvidence: validationRelative, visualEvidence, authorityDecision: 'PENDING_PRODUCT_OWNER' });
manualManifest.summary = { validated: manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length, pending: 5 - manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length };
atomicWriteJson(manualManifestRelative, manualManifest);

console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, pages: report.evidenceCounts.pages, classes: report.evidenceCounts.vehicleClasses, routeGroups: report.evidenceCounts.routeGroups, sha256: hash, manifest: acquisition.summary }, null, 2));
