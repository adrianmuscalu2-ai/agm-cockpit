import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/OWNER_MANUAL_INGEST/RT001-FINAL-FR-ORDER-12-2026.owner-official.pdf`;
const validationRelative = `${outputRelative}/OWNER_MANUAL_ARTIFACT_01_VALIDATION_REPORT.json`;
const manualManifestRelative = `${outputRelative}/OWNER_MANUAL_INGESTION_MANIFEST.json`;
const acquisitionRelative = `${outputRelative}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`;
const artifactId = 'RT001-FINAL-FR-ORDER-12-2026';
const sourceUrl = 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417592';
const directPdfUrl = 'https://www.legifrance.gouv.fr/download/file/I7R9VS2t0PfielS4ACisQCFhcwyKu5xIeQs35Cxnt70=/JOE_TEXTE';
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
const articles = Array.from({ length: 12 }, (_, index) => index + 1).map((number) => ({
  number,
  present: number === 1 ? /^\s*Art\.\s*1er\./m.test(text) : new RegExp(`^\\s*Art\\.\\s*${number}\\.`, 'm').test(text),
}));
const annexes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((number) => ({
  number,
  present: new RegExp(`ANNEXE\\s+${number}(?:\\s|$)`, 'm').test(text),
}));
const operators = ['ATMB', 'SFTRF', 'CEVM', 'ALIS', 'ARCOUR', 'ADELAC', 'A’LIENOR', 'ALICORNE', 'ATLANDES', 'ALBEA', 'ARCOS', 'ALIAE'].map((name) => ({
  name,
  present: text.toLocaleUpperCase('fr-FR').includes(name.toLocaleUpperCase('fr-FR')),
}));
const tariffGridHeaders = (text.match(/TARIFS EN EUROS TTC/gi) ?? []).length;
const vehicleClassHeadings = (text.match(/Véhicules?\s+de\s+classe\s+[1-5]/gi) ?? []).length;
const producer = latin.match(/\/Producer\s*\(([^)]*)\)/)?.[1] ?? null;
const creator = latin.match(/\/Creator\s*\(([^)]*)\)/)?.[1] ?? null;
const title = latin.match(/\/Title\s*\(([^)]*)\)/)?.[1] ?? null;
const creationDate = latin.match(/\/CreationDate\s*\(([^)]*)\)/)?.[1] ?? null;

check('PDF_MAGIC', bytes.subarray(0, 5).toString('ascii') === '%PDF-', bytes.subarray(0, 8).toString('ascii'), '%PDF-*');
check('PDF_EOF', latin.includes('%%EOF'), latin.includes('%%EOF'), true);
check('PDF_OPEN_AND_EXTRACT', pdftotextExit === 0 && text.length > 50_000, { pdftotextExit, textLength: text.length }, { pdftotextExit: 0, minimumTextLength: 50_000 });
check('ALL_PAGES_NONEMPTY', pages.length === 27 && pages.every((page) => page.trim().length > 500), { pageCount: pages.length, minimumPageText: Math.min(...pages.map((page) => page.trim().length)) }, { pageCount: 27, minimumPageText: 500 });
check('NOR', text.includes('TRAT2534086A'), text.includes('TRAT2534086A'), true);
check('JORF_TITLE_METADATA', title?.includes('Journal officiel de la République française - N° 25 du 30 janvier 2026'), title, 'Journal officiel ... N° 25 du 30 janvier 2026');
check('JORF_DATE_AND_TEXT_37', /30 janvier 2026\s+JOURNAL OFFICIEL DE LA RÉPUBLIQUE FRANÇAISE\s+Texte 37 sur 122/.test(text), text.split('\n')[0], '30 janvier 2026 / Texte 37 sur 122');
check('TITLE', text.includes('Arrêté du 28 janvier 2026 relatif aux péages applicables'), text.includes('Arrêté du 28 janvier 2026 relatif aux péages applicables'), true);
check('ARTICLES_1_TO_12', articles.every((item) => item.present), articles, '12/12');
check('ANNEXES_I_TO_XII', annexes.every((item) => item.present), annexes, '12/12');
check('OPERATORS_12', operators.every((item) => item.present), operators, '12/12');
check('TARIFF_GRIDS_12', tariffGridHeaders === 12, tariffGridHeaders, 12);
check('VEHICLE_CLASS_HEADINGS', vehicleClassHeadings >= 36, vehicleClassHeadings, '>=36');
check('EFFECTIVE_DATE', /1er février 2026/i.test(text), /1er février 2026/i.test(text), true);
check('NO_CHALLENGE_OR_ACCESS_DENIED', !/Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), /Cloudflare|security verification|Access denied|403 Forbidden/i.test(text), false);
check('OFFICIAL_PRODUCER', producer?.includes('PDFlib+PDI 9.0.6'), producer, 'PDFlib+PDI 9.0.6');
check('OFFICIAL_CREATOR', creator?.includes('PTC Arbortext Advanced Print Publisher'), creator, 'PTC Arbortext Advanced Print Publisher');
check('OFFICIAL_CREATION_DATE', creationDate?.startsWith("D:20260129"), creationDate, 'D:20260129*');

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
    authority: 'Legifrance / Journal officiel de la Republique francaise',
    officialPageUrl: sourceUrl,
    officialDirectPdfUrl: directPdfUrl,
    title,
    producer,
    creator,
    creationDate,
    jurisdiction: 'FR',
  },
  scope: "ATMB, SFTRF, CEVM, ALIS, ARCOUR, ADELAC, A'LIENOR, ALICORNE, ATLANDES, ALBEA, ARCOS and ALIAE; tariff annexes I-XII",
  effectiveDate: '2026-02-01',
  evidenceCounts: { pages: pages.length, articles: articles.filter((item) => item.present).length, annexes: annexes.filter((item) => item.present).length, operators: operators.filter((item) => item.present).length, tariffGridHeaders, vehicleClassHeadings },
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
manualManifest.artifacts.push({ artifactId, status: 'VALIDATED_INGESTED_REVIEW_ONLY', artifact: report.artifact, provenance: report.provenance, scope: report.scope, effectiveDate: report.effectiveDate, validationEvidence: validationRelative, authorityDecision: 'PENDING_PRODUCT_OWNER' });
manualManifest.summary = { validated: manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length, pending: 5 - manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length };
atomicWriteJson(manualManifestRelative, manualManifest);

console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, pages: report.evidenceCounts.pages, articles: report.evidenceCounts.articles, annexes: report.evidenceCounts.annexes, grids: report.evidenceCounts.tariffGridHeaders, classes: report.evidenceCounts.vehicleClassHeadings, sha256: hash, manifest: acquisition.summary }, null, 2));
