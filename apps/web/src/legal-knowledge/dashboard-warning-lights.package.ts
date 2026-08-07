import type { KnowledgeItem, KnowledgePackage } from './knowledge.contract';
import { dashboardWarningAssetManifest, type DashboardWarningAssetId } from './dashboard-warning-assets.manifest';

type DashboardWarningItem = KnowledgeItem & {
  recommendedAction: string;
  vehicleVariation: string;
  visualReference: {
    assetId: string;
    assetPath?: string;
    sha256?: string;
    sourceId: string;
    locator: string;
    assetStatus: 'reference-only' | 'verified';
    authorOrOrganization?: string;
    rightsHolder?: string;
    rightsRecord?: string;
    licenseType?: string;
    officialSourceUrl?: string;
    licenseVerifiedAt?: string;
    attributionRequired?: boolean;
    attributionText?: string;
    provenanceValidator?: string;
    visualQaValidator?: string;
  };
};

type VisualReferenceInput = Omit<DashboardWarningItem['visualReference'], 'assetId'>;

const verifiedAt = '2026-08-02';
const reviewDueAt = '2026-11-02';
const jurisdiction = 'UNECE / Uniunea Europeană; manualul exact al vehiculului are prioritate operațională';

function warning(
  id: string,
  topic: string,
  explanation: string,
  context: string,
  mistake: string,
  action: string,
  vehicleVariation: string,
  refs: KnowledgeItem['sourceReferences'],
  visualReference: VisualReferenceInput,
): DashboardWarningItem {
  return {
    id, topic,
    legalRule: 'Identificarea standardizată ajută la recunoaștere; semnificația completă se stabilește împreună cu mesajul și manualul vehiculului.',
    practicalExplanation: explanation,
    examples: [context],
    commonMistakes: [mistake],
    recommendedAction: action, vehicleVariation,
    sourceReferences: refs,
    visualReference: {
      assetId: `VA-${id}`,
      ...dashboardWarningAssetManifest[id as DashboardWarningAssetId],
      authorOrOrganization: 'AGM Cockpit internal design team',
      rightsHolder: 'Adrian — Product Owner AGM / Turn Commander',
      rightsRecord: 'Owner Clarification — Knowledge Operations — 2026-08-02',
      licenseType: 'Proprietary internal asset — internal use authorized',
      officialSourceUrl: `repo:${dashboardWarningAssetManifest[id as DashboardWarningAssetId].assetPath}`,
      licenseVerifiedAt: '2026-08-02',
      attributionRequired: false,
      provenanceValidator: 'Agent Legal — SVC-019 Legal/Compliance — PASS 2026-08-02',
      ...visualReference,
      assetStatus: 'verified',
      visualQaValidator: 'QA vizual independent — PASS 2026-08-02 — 96/64/48 px',
    },
    jurisdiction, verifiedAt, reviewDueAt,
  };
}

const r = (sourceId: string, locator: string) => ({ sourceId, locator });

export const dashboardWarningLightsKnowledgePackage: KnowledgePackage & { items: readonly DashboardWarningItem[] } = {
  id: 'KB-VEHICLE-WARN-001',
  domain: 'vehicle.dashboard-warning-lights',
  title: 'Martori de bord — recunoaștere și acțiune rapidă',
  jurisdiction, verifiedAt, reviewDueAt, version: '0.1.3', status: 'published',
  sources: [
    { id: 'UNECE-R121-001', title: 'UNECE — UN Regulation No. 121 Rev.2 + Amendment 6 (in force 24.09.2023)', url: 'https://unece.org/sites/default/files/2024-05/R121r2am6e.pdf', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'EU-GSR-001', title: 'Regulamentul (UE) 2019/2144 — consolidat la 02.08.2026', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02019R2144-20260802', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'MAN-TG3-001', title: 'MAN TGL — Breakdown assistance, DI.99185-1068', url: 'https://public.man.eu/media/service/asp/media/en/899275.pdf', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'MAN-TG3-002', title: 'MAN TGL/TGM — Check lamps, 81.99185-1068', url: 'https://public.man.eu/media/service/asp/media/es/615901.pdf', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
  ],
  items: [
    warning('WL-000', 'Domeniu juridic și limită', 'R121 standardizează pentru omologarea vehiculelor M/N identificarea, culoarea și iluminarea; Regulamentul UE 2019/2144 îl integrează în cadrul UE, fără a stabili diagnosticul ori reacția exactă.', 'Mesajul și manualul modelului completează identificarea standardizată.', 'Tratarea simbolului standard ca diagnostic complet.', 'Respectă legea și siguranța imediată; dacă deplasarea poate fi nesigură, oprește cât mai curând în siguranță și solicită ajutor calificat sau serviciile de urgență la pericol imediat.', 'Culoarea, starea fix/intermitent și mesajul diferă; manualul nu înlocuiește legea ori obligațiile de siguranță.', [r('UNECE-R121-001', 'Scope; Table 1; Rev.2 Amend.6 status'), r('EU-GSR-001', 'art. 4(5); Annex I entry 121; Annex II D9')], { sourceId: 'UNECE-R121-001', locator: 'Scope and Table 1', assetStatus: 'reference-only' }),
    warning('WL-001', 'STOP / avertizare critică', 'Mesaj critic specific producătorului, însoțit de explicația din instrumentație.', 'Poate însoți presiunea uleiului, frânele ori altă defecțiune critică.', 'Tratarea STOP ca simplu reminder.', 'Păstrează controlul, oprește când este sigur, citește mesajul și nu continua fără autorizarea procedurii exacte.', 'Simbol și reacție specifice modelului; verifică culoarea, clipirea și mesajul.', [r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Stop symbol with additional message')], { sourceId: 'MAN-TG3-002', locator: 'p.53 — Stop symbol', assetStatus: 'reference-only' }),
    warning('WL-002', 'Defecțiune sistem de frânare', 'Avertizarea poate privi frâna tractorului, remorcii ori presiunea pneumatică și este distinctă de frâna de parcare.', 'Poate apărea cu mesaj suplimentar, presiune de aer insuficientă sau frânare anormală.', 'Continuarea fiindcă pedala încă pare funcțională.', 'Redu controlat, oprește sigur, verifică mesajul și starea frânei de parcare; dacă persistă, presiunea este insuficientă ori frânarea este anormală, nu continua și cere asistență.', 'Verifică roșu/galben, fix/intermitent și dacă mesajul indică tractor, remorcă, parcare sau presiune aer.', [r('UNECE-R121-001', 'Table 1 — Brake system malfunction; identification only'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Brake system malfunction')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Brake system malfunction', assetStatus: 'reference-only' }),
    warning('WL-003', 'ABS limitat sau defect', 'Funcția antiblocare a tractorului sau remorcii poate fi limitată ori indisponibilă; frânarea de bază are statut separat.', 'Riscul devine relevant la frânare de urgență sau pe carosabil alunecos.', 'Confundarea cu pierderea certă a tuturor frânelor.', 'Mărește distanța, evită manevrele bruște, citește mesajul și urmează manualul; oprește dacă apare avertizarea de frână sau frânarea este anormală.', 'Mesajul stabilește tractor/remorcă; verifică culoarea și starea fix/intermitent.', [r('UNECE-R121-001', 'Table 1 — ABS malfunction; identification only'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — ABS limited/malfunction')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — ABS malfunction', assetStatus: 'reference-only' }),
    warning('WL-004', 'Presiune ulei motor prea mică', 'Simbolul identifică presiunea uleiului; mesajul/manualul stabilesc condiția concretă.', 'Martor sau mesaj apărut în mers.', 'Repornirea doar fiindcă nivelul pare corect.', 'Oprește imediat ținând cont de trafic, oprește motorul sigur, verifică nivelul conform manualului și cere atelier; nivelul corect nu autorizează repornirea ori continuarea fără procedura exactă.', 'Verifică roșu/galben, fix/intermitent și textul asociat.', [r('UNECE-R121-001', 'Table 1 — Engine oil pressure; identification only'), r('MAN-TG3-001', 'TGL, DI.99185-1068, p.197 — Oil pressure too low')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Engine oil pressure', assetStatus: 'reference-only' }),
    warning('WL-005', 'Temperatură lichid de răcire prea mare', 'Simbolul identifică temperatura lichidului; mesajul/manualul stabilesc condiția concretă.', 'Sarcină mare, urcare, nivel redus ori defecțiune.', 'Deschiderea imediată a sistemului fierbinte sub presiune.', 'Redu sarcina, oprește sigur și așteaptă/răcește conform manualului; nu deschide sistemul fierbinte sub presiune și cere ajutor dacă temperatura nu revine.', 'Verifică culoarea, clipirea, valoarea și mesajul asociat.', [r('UNECE-R121-001', 'Table 1 — Engine coolant temperature; identification only'), r('MAN-TG3-001', 'TGL, DI.99185-1068, p.197 — coolant/temperature messages')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Engine coolant temperature', assetStatus: 'reference-only' }),
    warning('WL-006', 'Defecțiune alternator / încărcare', 'Simbolul identifică starea încărcării; mesajul/manualul stabilesc defecțiunea concretă.', 'Poate apărea împreună cu alte mesaje.', 'Presupunerea că este doar o baterie veche.', 'Limitează consumatorii neesențiali numai dacă manualul permite, oprește controlat într-un loc sigur și cere service; nu conta pe funcționare îndelungată.', 'Verifică roșu/galben, fix/intermitent și mesajele electrice asociate.', [r('UNECE-R121-001', 'Table 1 — Battery charging condition; identification only'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Alternator malfunction')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Battery charging condition', assetStatus: 'reference-only' }),
    warning('WL-007', 'Defecțiune motor', 'Simbolul identifică o defecțiune legată de motor/emisii; severitatea o stabilesc culoarea, clipirea și mesajul.', 'Poate exista pierdere de putere.', 'Ștergerea prin repornire și ignorarea revenirii.', 'Citește mesajul și evită sarcina mare; la clipire, fum, zgomot, pierdere de putere ori roșu, oprește sigur și cere asistență.', 'Verifică fix/intermitent, culoarea, pierderea de putere și mesajul exact.', [r('UNECE-R121-001', 'Table 1 — Engine malfunction; identification only'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Engine malfunction')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Engine malfunction', assetStatus: 'reference-only' }),
    warning('WL-008', 'Nivel redus combustibil', 'Simbolul identifică nivelul redus la pragul stabilit de vehicul.', 'Autonomia variază cu sarcina și traseul.', 'Folosirea autonomiei afișate ca garanție.', 'Planifică alimentarea sigură cât mai curând, fără oprire nepermisă ori abatere riscantă.', 'Pragul, culoarea, autonomia și mesajul diferă între vehicule.', [r('UNECE-R121-001', 'Table 1 — Fuel level; identification only'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Fuel level low')], { sourceId: 'UNECE-R121-001', locator: 'Table 1 — Fuel level', assetStatus: 'reference-only' }),
    warning('WL-009', 'Nivel redus AdBlue® / reductant AUS 32', 'AdBlue® este denumirea practică pentru soluția AUS 32 utilizată de sistemul SCR; rezerva redusă poate anunța limitări viitoare.', 'Regulile de repornire și limitare sunt specifice vehiculului.', 'Ignorarea avertizărilor succesive.', 'Citește mesajul și completează cu produs conform specificației înainte de epuizare.', 'Simbolul, pragurile, culoarea și limitările sunt specifice modelului; AdBlue® este marcă VDA, menționată descriptiv.', [r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — AdBlue level low')], { sourceId: 'MAN-TG3-002', locator: 'p.53 — AdBlue level low', assetStatus: 'reference-only' }),
    warning('WL-010', 'Filtru de particule / regenerare', 'Filtrul poate solicita regenerare sau poate avea încărcare excesivă.', 'Regenerarea permisă diferă de mesajul de filtru complet colmatat.', 'Regenerarea lângă combustibile sau continuarea la risc de avarie.', 'Urmează exact manualul: numai într-un loc permis și ventilat, departe de combustibile, cu frâna/transmisia în starea cerută; la avertizare critică oprește sigur și contactează atelierul.', 'Simbolul, nivelurile de încărcare și permisiunea de regenerare sunt specifice modelului.', [r('MAN-TG3-001', 'TGL, DI.99185-1068, p.197 — Diesel particulate filter messages'), r('MAN-TG3-002', 'TGL/TGM, 81.99185-1068, p.53 — Exhaust gas aftertreatment')], { sourceId: 'MAN-TG3-001', locator: 'p.197 — DPF messages', assetStatus: 'reference-only' }),
  ],
  history: [
    { version: '0.1.0', changedAt: verifiedAt, author: 'Documentation Owner', summary: 'Primul set de zece fișe; imaginile sunt reference-only și publicarea este blocată.' },
    { version: '0.1.1', changedAt: verifiedAt, author: 'Documentation Owner', summary: 'Corecții Domain/Legal/QA: domeniu, variații vehicul, frâne pneumatice, acțiuni complete, surse și poartă vizuală.' },
    { version: '0.1.2', changedAt: verifiedAt, author: 'Documentation Owner', summary: 'Paritate canonică finală și condiție ABS pentru frânare anormală; activele vizuale rămân blocate.' },
    { version: '0.1.3', changedAt: verifiedAt, author: 'Publication Gate', summary: 'Proveniență PASS, QA vizual PASS la 96/64/48 px; 11/11 active verified și publicare autorizată.' },
  ],
  validation: {
    domainReviewed: true,
    legalReviewed: true,
    qaReviewed: true,
    domainValidator: 'Domain Owner — vehicule comerciale / mentenanță flotă',
    legalValidator: 'Agent Legal — SVC-019 Legal/Compliance',
    qaValidator: 'QA editorial și vizual independent — PASS',
    domainReviewedAt: '2026-08-02',
    legalReviewedAt: '2026-08-02',
    qaReviewedAt: '2026-08-02',
    holdReasons: [],
    contradictions: [],
  },
};
