import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/REMOTE_ARTIFACTS`;
const artifactDir = path.join(root, artifactRelative);
mkdirSync(artifactDir, { recursive: true });

const candidates = [
  {
    artifactId: 'RT001-FINAL-FR-INVENTORY-MINISTRY',
    domain: 'FRANCE_CONCESSION_INVENTORY',
    publisher: 'French Ministry for Transport / DGITM',
    scope: 'Official current inventory of 22 listed concession companies and statement of 20 current holders / 24 contracts',
    url: 'https://www.ecologie.gouv.fr/politiques-publiques/peages-autoroutes-france',
    filename: 'RT001-FINAL-FR-INVENTORY-MINISTRY.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FR-ORDER-12-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'Legifrance / Journal officiel de la Republique francaise',
    scope: '2026 tariff order and complete annexes for ATMB, SFTRF, CEVM, ALIS, ARCOUR, ADELAC, A-LIENOR, ALICORNE, ATLANDES, ALBEA, ARCOS and ALIAE',
    url: 'https://www.legifrance.gouv.fr/download/file/I7R9VS2t0PfielS4ACisQCFhcwyKu5xIeQs35Cxnt70=/JOE_TEXTE',
    filename: 'RT001-FINAL-FR-ORDER-12-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-APRR-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'APRR',
    scope: 'APRR route and vehicle-class tariff grid 2026',
    url: 'https://voyage.aprr.fr/sites/default/files/2026-02/TARIFS_APRR.pdf',
    filename: 'RT001-FINAL-FR-APRR-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-AREA-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'AREA / APRR',
    scope: 'AREA internal route and vehicle-class tariff grid 2026',
    url: 'https://voyage.aprr.fr/sites/default/files/2026-01/TARIFS_INTERNES_AREA.pdf',
    filename: 'RT001-FINAL-FR-AREA-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-ASF-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'VINCI Autoroutes / ASF',
    scope: 'ASF tariff guide applicable from 2026-06-01',
    url: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-asf/ASF-Guide-tarifaire-2026-maj062026.pdf',
    filename: 'RT001-FINAL-FR-ASF-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-COFIROUTE-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'VINCI Autoroutes / Cofiroute',
    scope: 'Cofiroute network tariff guide applicable from 2026-02-01',
    url: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Cofiroute/Cofiroute-Guide-tarifaire-2026.pdf',
    filename: 'RT001-FINAL-FR-COFIROUTE-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-COFIROUTE-A86-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'VINCI Autoroutes / Cofiroute',
    scope: 'Duplex A86 tariff grid applicable from 2026-01-01',
    url: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-Duplex-A86/Tarifs-Duplex-2026.pdf',
    filename: 'RT001-FINAL-FR-COFIROUTE-A86-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-ESCOTA-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'VINCI Autoroutes / Escota',
    scope: 'Escota tariff guide applicable from 2026-02-01',
    url: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Escota/Escota-Guide-tarifaire-2026.pdf',
    filename: 'RT001-FINAL-FR-ESCOTA-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-SANEF-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'Sanef',
    scope: 'Sanef route and vehicle-class tariff grid applicable from 2026-02-01',
    url: 'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf',
    filename: 'RT001-FINAL-FR-SANEF-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-SAPN-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'SAPN / Sanef',
    scope: 'SAPN Paris-Normandie route and vehicle-class tariff grid applicable from 2026-02-01',
    url: 'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf',
    filename: 'RT001-FINAL-FR-SAPN-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-CCISE-ORDER-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'Legifrance / Journal officiel de la Republique francaise',
    scope: 'Normandie and Tancarville bridge tariffs applicable from 2026-05-01',
    url: 'https://www.legifrance.gouv.fr/download/file/LGKIebDIuZvuVGlpCoWjSCa9Ybbg3VF7kUQ8OgMFAvo=/JOE_TEXTE',
    filename: 'RT001-FINAL-FR-CCISE-ORDER-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-A69-NOT-OPEN',
    domain: 'FRANCE_CONCESSION_APPLICABILITY',
    publisher: 'French Ministry for Transport',
    scope: 'Official evidence that A69 remained under construction with planned service in October 2026',
    url: 'https://www.ecologie.gouv.fr/presse/a69-entre-castres-toulouse-cour-administrative-dappel-retablit-autorisations',
    filename: 'RT001-FINAL-FR-A69-NOT-OPEN.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FR-A412-NOT-OPEN',
    domain: 'FRANCE_CONCESSION_APPLICABILITY',
    publisher: 'Prefecture de la Haute-Savoie',
    scope: 'Official current project evidence: A412 assigned for design and construction, not an operating tolled network in 2026',
    url: 'https://www.haute-savoie.gouv.fr/Actions-de-l-Etat/Votre-departement/Deplacements/Autoroute-du-Chablais-A412',
    filename: 'RT001-FINAL-FR-A412-NOT-OPEN.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FR-MONTBLANC-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'ATMB',
    scope: 'Mont Blanc road tunnel tariffs applicable from 2026-01-01',
    url: 'https://www.atmb.com/app/uploads/2026/01/Tarifs-au-1er-janvier-2026-TMB.pdf',
    filename: 'RT001-FINAL-FR-MONTBLANC-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FR-FREJUS-2026',
    domain: 'FRANCE_CONCESSION_TARIFFS',
    publisher: 'SFTRF',
    scope: 'Frejus road tunnel tariffs on the French platform applicable from 2026-01-01',
    url: 'https://www.sftrf.fr/wp-content/uploads/2025/12/Tarifs_tunnel_2026_FR.pdf',
    filename: 'RT001-FINAL-FR-FREJUS-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-TUNNEL-INVENTORY',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Agentschap Wegen en Verkeer Vlaanderen',
    scope: 'Official Flemish road-tunnel inventory identifying Liefkenshoek and its separate operator',
    url: 'https://wegenenverkeer.be/wegen/wegennet/tunnels',
    filename: 'RT001-FINAL-FAC-BE-TUNNEL-INVENTORY.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-EETS',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Viapass',
    scope: 'Official Belgian EETS page identifying Liefkenshoek as a separate toll domain',
    url: 'https://www.viapass.be/en/faqs-and-resources/eets-european-electronic-toll-services-in-belgium/',
    filename: 'RT001-FINAL-FAC-BE-EETS.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026',
    domain: 'FACILITIES_TARIFFS',
    publisher: 'Tunnel Liefkenshoek NV',
    scope: 'Official 2026 Liefkenshoek Tunnel categories, tariffs and conditions; no unofficial substitute is permitted',
    url: 'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026.pdf',
    filename: 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026.official.pdf',
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-OOSTERWEEL-FUTURE',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Lantis',
    scope: 'Official evidence that the Scheldt/Oosterweel toll connection is a future facility, not applicable to 2026 routing tariffs',
    url: 'https://www.lantis.be/nieuws/vergunningsaanvraag-voor-oosterweel-op-rechteroever-ingediend',
    filename: 'RT001-FINAL-FAC-BE-OOSTERWEEL-FUTURE.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-NL-NATIONAL-SCOPE',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Government of the Netherlands',
    scope: 'Official national evidence identifying Kiltunnel and Westerscheldetunnel as separately managed toll facilities',
    url: 'https://www.rijksoverheid.nl/actueel/nieuws/2022/07/01/vanaf-2030-betalen-automobilisten-naar-gebruik',
    filename: 'RT001-FINAL-FAC-NL-NATIONAL-SCOPE.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-NL-A24-VIA15-SCOPE',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Government of the Netherlands',
    scope: 'Official scope and applicability evidence for current A24 temporary toll and future Via15 toll',
    url: 'https://www.rijksoverheid.nl/themas/verkeer-en-vervoer/wegen/tijdelijke-tolheffing-blankenburgverbinding-en-via15',
    filename: 'RT001-FINAL-FAC-NL-A24-VIA15-SCOPE.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-NL-NIEUWERBRUG',
    domain: 'FACILITIES_SCOPE',
    publisher: 'Tolbrug Nieuwerbrug operator',
    scope: 'Operator evidence for the local private toll bridge; exact vehicle tariff authority remains unresolved',
    url: 'https://tolbrugnieuwerbrug.nl/',
    filename: 'RT001-FINAL-FAC-NL-NIEUWERBRUG.official.html',
  },
  {
    artifactId: 'RT001-FINAL-FAC-DE-FMODEL',
    domain: 'FACILITIES_SCOPE',
    publisher: 'German Federal Ministry for Transport (BMV)',
    scope: 'Official inventory stating exactly two realised F-model toll facilities: Warnowquerung and Herrentunnel',
    url: 'https://www.bmv.de/SharedDocs/DE/Artikel/StB/oepp-geschaeftsmodelle-f-modell.html',
    filename: 'RT001-FINAL-FAC-DE-FMODEL.official.html',
  },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const acquiredAt = new Date().toISOString();

async function acquire(candidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(candidate.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'AGM-Canonical-Evidence-Acquisition/1.0 (+Product Owner controlled review)',
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
      status: 'INTEGRITY_CAPTURED_REVIEW_ONLY',
      finalUrl: response.url,
      canonicalPath: `${artifactRelative}/${candidate.filename}`,
      mediaType: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream',
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
      acquisitionTimestamp: acquiredAt,
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
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all(candidates.map(acquire));
const manifest = {
  schemaVersion: 'agm-routing-toll-001-final-closure-acquisition.v1',
  generatedAt: acquiredAt,
  baseline: {
    registryCount: 831,
    registrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
    routingTollViewCount: 279,
    routingTollViewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
  },
  purpose: 'OFFICIAL_EVIDENCE_ACQUISITION_AND_OWNER_REVIEW_PREPARATION_ONLY',
  registryMutation: 'NONE',
  viewMutation: 'NONE',
  authorityPromotion: 'NONE',
  items: results,
  summary: {
    requested: results.length,
    captured: results.filter((item) => item.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY').length,
    blocked: results.filter((item) => item.status === 'INTEGRITY_BLOCKED').length,
  },
};

writeFileSync(path.join(root, outputRelative, 'FINAL_CLOSURE_ACQUISITION_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest.summary, null, 2));
