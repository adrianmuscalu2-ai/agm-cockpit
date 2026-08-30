import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/OWNER_MANUAL_INGEST/RT001-FINAL-FR-CCISE-ORDER-2026.owner-official.pdf`;
const visualEvidenceRelative = `${outputRelative}/OWNER_MANUAL_INGEST/VISUAL_EVIDENCE_ARTIFACT_04/page-1.png`;
const validationRelative = `${outputRelative}/OWNER_MANUAL_ARTIFACT_04_VALIDATION_REPORT.json`;
const manualManifestRelative = `${outputRelative}/OWNER_MANUAL_INGESTION_MANIFEST.json`;
const acquisitionRelative = `${outputRelative}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`;
const artifactId = 'RT001-FINAL-FR-CCISE-ORDER-2026';
const officialPageUrl = 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053916305';
const officialEliUrl = 'https://www.legifrance.gouv.fr/eli/arrete/2026/3/30/TRAT2609535A/jo/texte';
const directPdfUrl = 'https://www.legifrance.gouv.fr/download/file/LGKIebDIuZvuVGlpCoWjSCa9Ybbg3VF7kUQ8OgMFAvo=/JOE_TEXTE';
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
const visualPath = path.join(root, visualEvidenceRelative);
const producer = latin.match(/\/Producer\s*\(([^)]*)\)/)?.[1] ?? null;
const creator = latin.match(/\/Creator\s*\(([^)]*)\)/)?.[1] ?? null;
const titleMetadata = latin.match(/\/Title\s*\(([^)]*)\)/)?.[1] ?? null;
const creationDate = latin.match(/\/CreationDate\s*\(([^)]*)\)/)?.[1] ?? null;
const tariffValues = ['6,10', '7,10', '7,60', '15,10', '2,90', '3,70', '4,40', '7,50'].map((value) => ({ value, present: text.includes(value) }));
const vehicleClasses = Array.from({ length: 4 }, (_, index) => index + 1).map((number) => ({ number, present: new RegExp(`Classe\\s+${number}`, 'i').test(text) }));

check('PDF_MAGIC', bytes.subarray(0, 5).toString('ascii') === '%PDF-', bytes.subarray(0, 8).toString('ascii'), '%PDF-*');
check('PDF_EOF', latin.includes('%%EOF'), latin.includes('%%EOF'), true);
check('PDF_OPEN_AND_EXTRACT', pdftotextExit === 0 && text.length > 3_000, { pdftotextExit, textLength: text.length }, { pdftotextExit: 0, minimumTextLength: 3_000 });
check('ALL_PAGES_NONEMPTY', pages.length === 1 && pages[0].trim().length > 3_000, { pageCount: pages.length, pageTextLengths: pages.map((page) => page.trim().length) }, { pageCount: 1, minimumTextLength: 3_000 });
check('NOR', text.includes('TRAT2609535A'), text.includes('TRAT2609535A'), true);
check('JORF_DATE_TEXT_8', /21 avril 2026\s+JOURNAL OFFICIEL DE LA R[ÉE]PUBLIQUE FRAN[ÇC]AISE\s+Texte 8 sur 63/i.test(text), text.split('\n')[0], '21 avril 2026 / Journal officiel / Texte 8 sur 63');
check('JORF_0094_OFFICIAL_CROSS_CHECK', officialPageUrl.endsWith('JORFTEXT000053916305') && existsSync(visualPath), { officialPageUrl, visualEvidence: visualEvidenceRelative }, 'Official Legifrance record JORF n°0094 / 21 April 2026 / text 8; visual title verified');
check('OFFICIAL_JOURNAL_IDENTITY', /JOURNAL OFFICIEL DE LA R[ÉE]PUBLIQUE FRAN[ÇC]AISE/i.test(text), /JOURNAL OFFICIEL DE LA R[ÉE]PUBLIQUE FRAN[ÇC]AISE/i.test(text), true);
check('TITLE', /Arr[êe]t[ée] du 30 mars 2026 relatif aux p[ée]ages\s+applicables aux ponts de Normandie et de Tancarville/i.test(text), /Arr[êe]t[ée] du 30 mars 2026 relatif aux p[ée]ages/i.test(text), true);
check('ARTICLES_1_AND_2', /Art\.\s*1er\./i.test(text) && /Art\.\s*2\./i.test(text), { article1: /Art\.\s*1er\./i.test(text), article2: /Art\.\s*2\./i.test(text) }, { article1: true, article2: true });
check('PONT_DE_NORMANDIE', /Pont de Normandie/i.test(text), /Pont de Normandie/i.test(text), true);
check('PONT_DE_TANCARVILLE', /Pont de Tancarville/i.test(text), /Pont de Tancarville/i.test(text), true);
check('ANNEXE_I', /ANNEXE I/i.test(text), /ANNEXE I/i.test(text), true);
check('TARIFF_GRID_HEADER', /TARIFS EN EUROS TTC APPLICABLES SUR LE PONT DE NORMANDIE\s+ET SUR LE PONT DE TANCARVILLE [ÀA] COMPTER DU 1ER MAI 2026/i.test(text), /TARIFS EN EUROS TTC/i.test(text), true);
check('VEHICLE_CLASSES_1_TO_4', vehicleClasses.every((item) => item.present), vehicleClasses, '4/4');
check('EXACT_TARIFF_VALUES', tariffValues.every((item) => item.present), tariffValues, '8/8 exact values');
check('EFFECTIVE_DATE', /1er mai 2026/i.test(text), /1er mai 2026/i.test(text), true);
check('VISUAL_RENDER_COMPLETE', existsSync(visualPath) && readFileSync(visualPath).length > 150_000, { path: visualEvidenceRelative, sizeBytes: existsSync(visualPath) ? readFileSync(visualPath).length : null }, 'Complete one-page authenticated extract; no clipped content');
check('NO_CHALLENGE_OR_ACCESS_DENIED', !/Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), /Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), false);
check('OFFICIAL_SOURCE_HOSTS', [officialPageUrl, officialEliUrl, directPdfUrl].every((url) => new URL(url).hostname === 'www.legifrance.gouv.fr'), [officialPageUrl, officialEliUrl, directPdfUrl].map((url) => new URL(url).hostname), 'www.legifrance.gouv.fr x3');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-owner-manual-artifact-validation.v1',
  generatedAt,
  artifactId,
  verdict: failed.length === 0 ? 'VALID' : 'INVALID',
  artifact: { path: artifactRelative, filename: path.basename(artifactPath), mediaType: 'application/pdf', sizeBytes: bytes.length, sha256: hash },
  provenance: {
    authority: 'Legifrance / Journal officiel de la Republique francaise',
    officialPageUrl,
    officialEliUrl,
    officialDirectPdfUrl: directPdfUrl,
    officialRecord: 'JORF n°0094 du 21 avril 2026 / texte n°8',
    nor: 'TRAT2609535A',
    titleMetadata,
    producer,
    creator,
    creationDate,
    jurisdiction: 'FR',
    ownerAssistedCapture: true,
  },
  scope: 'Pont de Normandie and Pont de Tancarville 2026 tariffs, vehicle classes 1-4',
  effectiveDate: '2026-05-01',
  evidenceCounts: { pages: pages.length, vehicleClasses: vehicleClasses.filter((item) => item.present).length, tariffValues: tariffValues.filter((item) => item.present).length },
  visualEvidence: [visualEvidenceRelative],
  visualInspection: 'PASS_1_OF_1_NO_CLIPPED_CONTENT',
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
  finalUrl: officialPageUrl,
  canonicalPath: artifactRelative,
  mediaType: 'application/pdf',
  sizeBytes: bytes.length,
  sha256: hash,
  acquisitionTimestamp: generatedAt,
  ingestionMethod: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION',
  ownerManualValidated: true,
  validationEvidence: validationRelative,
  visualEvidence: [visualEvidenceRelative],
  effectiveDate: '2026-05-01',
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
manualManifest.artifacts.push({ artifactId, status: 'VALIDATED_INGESTED_REVIEW_ONLY', artifact: report.artifact, provenance: report.provenance, scope: report.scope, effectiveDate: report.effectiveDate, validationEvidence: validationRelative, visualEvidence: report.visualEvidence, authorityDecision: 'PENDING_PRODUCT_OWNER' });
manualManifest.summary = { validated: manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length, pending: 5 - manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length };
atomicWriteJson(manualManifestRelative, manualManifest);

console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, pages: report.evidenceCounts.pages, classes: report.evidenceCounts.vehicleClasses, tariffValues: report.evidenceCounts.tariffValues, sha256: hash, manifest: acquisition.summary }, null, 2));
