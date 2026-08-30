import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY';
const artifactRelative = `${outputRelative}/REMOTE_ARTIFACTS`;
const artifactDir = path.join(root, artifactRelative);
mkdirSync(artifactDir, { recursive: true });

const candidates = [
  {
    candidateId: 'RT001-RES-PL-A1-2026',
    residualId: 'RT001-RES-002',
    jurisdiction: 'PL',
    publisher: 'AmberOne / Gdansk Transport Company S.A.',
    scope: 'A1 Gdansk-Torun concession passenger/light and vehicle-category tariffs',
    url: 'https://a1.com.pl/kalkulator-oplat-i-planowanie-podrozy/',
    filename: 'RT001-RES-PL-A1-2026.official.html',
  },
  {
    candidateId: 'RT001-RES-PL-A2-2026',
    residualId: 'RT001-RES-002',
    jurisdiction: 'PL',
    publisher: 'Autostrada Wielkopolska S.A.',
    scope: 'A2 Swiecko-Konin concession route/category tariff grid',
    url: 'https://www.autostrada-a2.pl/wp-content/uploads/2026/02/AW-tabele-oplat-03.2026_06.pdf',
    filename: 'RT001-RES-PL-A2-2026.official.pdf',
  },
  {
    candidateId: 'RT001-RES-PL-A4-2026',
    residualId: 'RT001-RES-002',
    jurisdiction: 'PL',
    publisher: 'Stalexport Autostrada Malopolska S.A.',
    scope: 'A4 Katowice-Krakow concession vehicle-category tariffs effective 2026-04-01',
    url: 'https://www.autostrada-a4.com.pl/pl/oplaty/oplaty-i-sposoby-wnoszenia-oplat-cennik?version=pl',
    filename: 'RT001-RES-PL-A4-2026.official.html',
  },
  {
    candidateId: 'RT001-RES-CH-LSVA-RATES',
    residualId: 'RT001-RES-003',
    jurisdiction: 'CH',
    publisher: 'Swiss Federal Office for Customs and Border Security (FOCBS/BAZG)',
    scope: 'Exact LSVA rates valid from 2025-01-01; currentness still requires human applicability review',
    url: 'https://www.bazg.admin.ch/dam/bazg/de/dokumente/abgaben/AVEA/AVAI/G%C3%BCltige%20LSVA-Tarife%20ab%2001.01.2025.pdf.download.pdf/G%C3%BCltige%20LSVA-Tarife%20ab%2001.01.2025.pdf',
    filename: 'RT001-RES-CH-LSVA-RATES.official.pdf',
  },
  {
    candidateId: 'RT001-RES-CH-VIGNETTE-2026',
    residualId: 'RT001-RES-003',
    jurisdiction: 'CH',
    publisher: 'Swiss Confederation public authority portal',
    scope: '2026 motorway vignette price, vehicle scope and validity',
    url: 'https://www.ch.ch/en/vehicles-and-traffic/how-to-behave-in-road-traffic/motorway-vignette/',
    filename: 'RT001-RES-CH-VIGNETTE-2026.official.html',
  },
  {
    candidateId: 'RT001-RES-LU-EUROVIGNETTE-SCOPE',
    residualId: 'RT001-RES-004',
    jurisdiction: 'LU',
    publisher: 'Luxembourg Customs and Excise Administration',
    scope: 'Eurovignette applicability, road and vehicle scope',
    url: 'https://douanes.public.lu/fr/vehicules/eurovignette.html',
    filename: 'RT001-RES-LU-EUROVIGNETTE-SCOPE.official.html',
  },
  {
    candidateId: 'RT001-RES-LU-EUROVIGNETTE-RATES',
    residualId: 'RT001-RES-004',
    jurisdiction: 'LU',
    publisher: 'Luxembourg Customs and Excise Administration',
    scope: 'Eurovignette tariff grid applicable from 2025-03-25',
    url: 'https://douanes.public.lu/content/dam/douanes/fr/v%C3%A9hicules/eurovignette/ev-tarif-from-25032025.pdf',
    filename: 'RT001-RES-LU-EUROVIGNETTE-RATES.official.pdf',
  },
  {
    candidateId: 'RT001-RES-BE-LIEFKENSHOEK-2026',
    residualId: 'RT001-RES-005',
    jurisdiction: 'BE',
    publisher: 'N.V. Tunnel Liefkenshoek',
    scope: 'Liefkenshoek Tunnel 2026 categories and rates',
    url: 'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026_engels.pdf',
    filename: 'RT001-RES-BE-LIEFKENSHOEK-2026.official.pdf',
  },
  {
    candidateId: 'RT001-RES-DE-WARNOW-2025',
    residualId: 'RT001-RES-005',
    jurisdiction: 'DE',
    publisher: 'Mecklenburg-Western Pomerania official gazette via Warnowquerung operator',
    scope: 'Warnow Tunnel tariffs effective 2025-11-01',
    url: 'https://www.warnowquerung.de/wp-content/uploads/GVOBl.-Nr.-19-v.-15.10.2025.pdf',
    filename: 'RT001-RES-DE-WARNOW-2025.official.pdf',
  },
  {
    candidateId: 'RT001-RES-DE-HERREN',
    residualId: 'RT001-RES-005',
    jurisdiction: 'DE',
    publisher: 'Herrentunnel Lubeck operator',
    scope: 'Herrentunnel charge basis and current operator tariff table page',
    url: 'https://www.herrentunnel-luebeck.de/index.php/maut-tarife.html',
    filename: 'RT001-RES-DE-HERREN.official.html',
  },
  {
    candidateId: 'RT001-RES-NL-KILTUNNEL',
    residualId: 'RT001-RES-005',
    jurisdiction: 'NL',
    publisher: 'Kiltunnel public operator',
    scope: 'Kiltunnel height-based tariffs',
    url: 'https://kiltunnel.nl/faq?cat=7',
    filename: 'RT001-RES-NL-KILTUNNEL.official.html',
  },
  {
    candidateId: 'RT001-RES-NL-WESTERSCHELDE-2026',
    residualId: 'RT001-RES-005',
    jurisdiction: 'NL',
    publisher: 'N.V. Westerscheldetunnel',
    scope: '2026 vehicle categories, zero/light scope and heavy-vehicle tariffs',
    url: 'https://www.westerscheldetunnel.nl/nl/tarieven-betaalmiddelen/tarieven/',
    filename: 'RT001-RES-NL-WESTERSCHELDE-2026.official.html',
  },
  {
    candidateId: 'RT001-RES-DK-KMTOLL-TARIFF-V12',
    residualId: 'RT001-RES-006',
    jurisdiction: 'DK',
    publisher: 'Sund & Baelt Holding A/S / Danish KmToll authority',
    scope: 'KmToll tariff table v1.2 dated 2025-11-07',
    url: 'https://vejafgifter.dk/media/rtopb53s/annex-b-tariff-table-_v12.pdf',
    filename: 'RT001-RES-DK-KMTOLL-TARIFF-V12.official.pdf',
  },
  {
    candidateId: 'RT001-RES-NL-TRUCK-RATES-2026',
    residualId: 'RT001-RES-006',
    jurisdiction: 'NL',
    publisher: 'Dutch truck toll authority / RDW',
    scope: 'Exact 2026 distance-based rates, including time-bounded 2026 tariff bands',
    url: 'https://www.vrachtwagenheffing.nl/-/media/trucktol/website/wat-gaat-het-kosten/toegankelijke-pdfs/rdw-tabellen-bedragen-vrachtwagenheffing.pdf?hash=65AEA64054AD8D4BBD1D7D0C7707D5B6&rev=790ab60be70848829bbe40c5e2360320',
    filename: 'RT001-RES-NL-TRUCK-RATES-2026.official.pdf',
  },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const acquiredAt = new Date().toISOString();

async function acquire(candidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(candidate.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'AGM-Canonical-Integrity-Acquisition/1.0 (+controlled Product Owner review)',
        accept: 'text/html,application/pdf,application/octet-stream;q=0.8,*/*;q=0.5',
      },
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 512) throw new Error(`ARTIFACT_TOO_SMALL_${bytes.length}`);
    const target = path.join(artifactDir, candidate.filename);
    writeFileSync(target, bytes);
    return {
      ...candidate,
      status: 'INTEGRITY_CAPTURED_PROPOSAL_ONLY',
      finalUrl: response.url,
      canonicalPath: `${artifactRelative}/${candidate.filename}`,
      mediaType: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream',
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
      acquisitionTimestamp: acquiredAt,
      registryMutationAuthorized: false,
      authorityPromotionAuthorized: false,
    };
  } catch (error) {
    return {
      ...candidate,
      status: 'INTEGRITY_BLOCKED',
      error: error instanceof Error ? error.message : String(error),
      finalUrl: null,
      canonicalPath: null,
      mediaType: null,
      sizeBytes: null,
      sha256: null,
      acquisitionTimestamp: acquiredAt,
      registryMutationAuthorized: false,
      authorityPromotionAuthorized: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all(candidates.map(acquire));
const manifest = {
  schemaVersion: 'agm-routing-toll-001-residual-integrity.v1',
  generatedAt: acquiredAt,
  baseline: {
    registryCount: 831,
    registrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
    routingTollViewCount: 279,
    routingTollViewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
  },
  purpose: 'READ_ONLY_CLOSURE_EVIDENCE_AND_OWNER_REVIEW_PROPOSAL',
  registryMutation: 'NOT_AUTHORIZED_NOT_EXECUTED',
  items: results,
  summary: {
    requested: results.length,
    captured: results.filter((item) => item.status === 'INTEGRITY_CAPTURED_PROPOSAL_ONLY').length,
    blocked: results.filter((item) => item.status === 'INTEGRITY_BLOCKED').length,
  },
};

writeFileSync(path.join(root, outputRelative, 'RESIDUAL_REMOTE_ACQUISITION_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest.summary, null, 2));
