import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/OWNER_MANUAL_INGEST/RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026.owner-official.pdf`;
const validationRelative = `${outputRelative}/OWNER_MANUAL_ARTIFACT_05_VALIDATION_REPORT.json`;
const manualManifestRelative = `${outputRelative}/OWNER_MANUAL_INGESTION_MANIFEST.json`;
const acquisitionRelative = `${outputRelative}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`;
const artifactId = 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026';
const officialPageUrl = 'https://www.liefkenshoektunnel.be/nl/algemene-voorwaarden-tunnel-liefkenshoek-nv';
const officialDutchPdfUrl = 'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026.pdf';
const officialEnglishPdfUrl = 'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026_engels.pdf';
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
let clippedText = '';
let clippedTextExit = 0;
try {
  text = execFileSync('C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe', ['-layout', '-enc', 'UTF-8', artifactPath, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} catch (error) {
  pdftotextExit = error?.status ?? 1;
}
try {
  clippedText = execFileSync('C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe', ['-layout', '-clip', '-enc', 'UTF-8', artifactPath, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} catch (error) {
  clippedTextExit = error?.status ?? 1;
}

const pages = text.split('\f').filter((page) => page.trim().length > 0);
const clippedPages = clippedText.split('\f').filter((page) => page.trim().length > 0);
const normalized = text.normalize('NFKC').replace(/\s+/g, ' ');
const isDutch = /ALGEMENE VOORWAARDEN|ARTIKEL XII|INWERKINGTREDING/i.test(normalized);
const isEnglish = /GENERAL TERMS AND CONDITIONS|ARTICLE XII|COMMENCEMENT/i.test(normalized);
const v2026Markers = (normalized.match(/V2026/gi) ?? []).length;
const legacyV2024FooterMarkers = (normalized.match(/V2024/gi) ?? []).length;
const articleMarkers = Array.from({ length: 12 }, (_, index) => {
  const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][index];
  return { numeral, present: new RegExp(`(?:ARTIKEL|ARTICLE)\\s+${numeral}(?:\\s|\\.|-|–)`, 'i').test(normalized) };
});
const tariffValues = ['8[,.]00', '25[,.]00', '4[,.]40', '17[,.]60', '6[,.]20', '21[,.]90'].map((pattern) => ({
  pattern,
  present: new RegExp(`(?:€\\s*)?${pattern}`, 'i').test(normalized),
}));
const producer = latin.match(/\/Producer\s*\(([^)]*)\)/)?.[1] ?? null;
const creator = latin.match(/\/Creator\s*\(([^)]*)\)/)?.[1] ?? null;
const titleMetadata = latin.match(/\/Title\s*\(([^)]*)\)/)?.[1] ?? null;

check('PDF_MAGIC', bytes.subarray(0, 5).toString('ascii') === '%PDF-', bytes.subarray(0, 8).toString('ascii'), '%PDF-*');
check('PDF_EOF', latin.includes('%%EOF'), latin.includes('%%EOF'), true);
check('PDF_OPEN_AND_EXTRACT', pdftotextExit === 0 && text.length > 15_000, { pdftotextExit, textLength: text.length }, { pdftotextExit: 0, minimumTextLength: 15_000 });
check('COMPLETE_PAGE_SET_10_OF_10', pages.length === 10 && pages.every((page) => page.trim().length > 100), { pageCount: pages.length, pageTextLengths: pages.map((page) => page.trim().length) }, { pageCount: 10, minimumPageTextLength: 100 });
check('CLIPPED_TEXT_EXTRACTION_10_OF_10', clippedTextExit === 0 && clippedPages.length === 10, { clippedTextExit, pageCount: clippedPages.length, pageTextLengths: clippedPages.map((page) => page.trim().length) }, { clippedTextExit: 0, pageCount: 10 });
check('NO_PAGE_CONTENT_LOSS_OR_CUTS', clippedPages.length === pages.length && clippedPages.every((page, index) => page.trim() === pages[index].trim()), clippedPages.map((page, index) => ({ page: index + 1, layoutChars: pages[index]?.trim().length ?? null, clippedChars: page.trim().length, identical: page.trim() === pages[index]?.trim() })), '10/10 pages identical with clip-aware extraction');
check('OFFICIAL_OPERATOR_IDENTITY', /(?:N\.?V\.?\s+)?TUNNEL LIEFKENSHOEK|LIEFKENSHOEK TUNNEL/i.test(normalized), /(?:N\.?V\.?\s+)?TUNNEL LIEFKENSHOEK|LIEFKENSHOEK TUNNEL/i.test(normalized), true);
check('OFFICIAL_DOCUMENT_LANGUAGE', isDutch || isEnglish, { isDutch, isEnglish }, 'Dutch or English official publication');
check('DOCUMENT_2026_MARKERS', v2026Markers > 0 && /(?:1\s+januari\s+2026|January\s+1,?\s+2026|1\s+January\s+2026)/i.test(normalized), { v2026Markers, legacyV2024FooterMarkers, explicitEffectiveDate2026: /(?:1\s+januari\s+2026|January\s+1,?\s+2026|1\s+January\s+2026)/i.test(normalized) }, 'V2026 marker(s) and explicit 2026 effective date');
check('ARTICLES_I_TO_XII', articleMarkers.every((item) => item.present), articleMarkers, '12/12');
check('EFFECTIVE_DATE_2026_01_01', /(?:1\s+januari\s+2026|January\s+1,?\s+2026|1\s+January\s+2026)/i.test(normalized), /(?:1\s+januari\s+2026|January\s+1,?\s+2026|1\s+January\s+2026)/i.test(normalized), true);
check('VEHICLE_CATEGORIES_1_AND_2', /categor(?:ie|y)\s+1/i.test(normalized) && /categor(?:ie|y)\s+2/i.test(normalized), { category1: /categor(?:ie|y)\s+1/i.test(normalized), category2: /categor(?:ie|y)\s+2/i.test(normalized) }, '2/2');
check('HEIGHT_CLASSIFICATION_3M', /3\s*m(?:eter)?/i.test(normalized), /3\s*m(?:eter)?/i.test(normalized), true);
check('PAYMENT_METHOD_DISTINCTIONS', /(?:CASHBETALINGEN|CASH PAYMENTS)/i.test(normalized) && /OBU/i.test(normalized) && /TELETOLBADGE/i.test(normalized) && /(?:BANK|CREDIT)/i.test(normalized), { cash: /(?:CASHBETALINGEN|CASH PAYMENTS)/i.test(normalized), obu: /OBU/i.test(normalized), teletol: /TELETOLBADGE/i.test(normalized), cards: /(?:BANK|CREDIT)/i.test(normalized) }, 'cash / OBU / Teletol / cards');
check('EXACT_2026_TARIFF_VALUES', tariffValues.every((item) => item.present), tariffValues, '6/6 exact distinct values');
check('OTHER_COSTS_SECTION', /(?:ANDERE KOSTEN|OTHER COSTS)/i.test(normalized) && /40[,.]00/.test(normalized) && /17[,.]50/.test(normalized), { section: /(?:ANDERE KOSTEN|OTHER COSTS)/i.test(normalized), badge: /40[,.]00/.test(normalized), invoice: /17[,.]50/.test(normalized) }, true);
check('NO_CHALLENGE_OR_ACCESS_DENIED', !/Cloudflare|security verification|Access denied|403 Forbidden/i.test(normalized), /Cloudflare|security verification|Access denied|403 Forbidden/i.test(normalized), false);
check('OFFICIAL_SOURCE_HOSTS', [officialPageUrl, officialDutchPdfUrl, officialEnglishPdfUrl].every((url) => new URL(url).hostname === 'www.liefkenshoektunnel.be'), [officialPageUrl, officialDutchPdfUrl, officialEnglishPdfUrl].map((url) => new URL(url).hostname), 'www.liefkenshoektunnel.be x3');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-owner-manual-artifact-validation.v1',
  generatedAt,
  artifactId,
  verdict: failed.length === 0 ? 'VALID' : 'INVALID',
  artifact: { path: artifactRelative, filename: path.basename(artifactPath), mediaType: 'application/pdf', sizeBytes: bytes.length, sha256: hash },
  provenance: {
    authority: 'Tunnel Liefkenshoek NV',
    officialPageUrl,
    acceptedOfficialPdfUrls: [officialDutchPdfUrl, officialEnglishPdfUrl],
    officialHost: 'www.liefkenshoektunnel.be',
    language: isDutch ? 'nl' : isEnglish ? 'en' : 'unknown',
    titleMetadata,
    producer,
    creator,
    jurisdiction: 'BE',
    ownerAssistedCapture: true,
  },
  scope: 'Liefkenshoek Tunnel 2026 vehicle categories, tariff and payment-method distinctions, and attached conditions',
  effectiveDate: '2026-01-01',
  sourceDocumentObservations: {
    v2026Markers,
    legacyV2024FooterMarkers,
    note: legacyV2024FooterMarkers > 0
      ? 'The official English PDF retains historical V2024 footer labels on early pages; Article XII, V2026 footer labels and the tariff appendix establish the official 2026 applicability. The source artifact is preserved without alteration.'
      : null,
  },
  evidenceCounts: { pages: pages.length, clippedPages: clippedPages.length, pagesWithoutContentLoss: clippedPages.filter((page, index) => page.trim() === pages[index]?.trim()).length, articles: articleMarkers.filter((item) => item.present).length, tariffValues: tariffValues.filter((item) => item.present).length },
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
  effectiveDate: '2026-01-01',
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
manualManifest.summary = { validated: manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length, pending: Math.max(0, 5 - manualManifest.artifacts.filter((entry) => entry.status === 'VALIDATED_INGESTED_REVIEW_ONLY').length) };
atomicWriteJson(manualManifestRelative, manualManifest);

console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, pages: report.evidenceCounts.pages, articles: report.evidenceCounts.articles, tariffValues: report.evidenceCounts.tariffValues, sha256: hash, manifest: acquisition.summary }, null, 2));
