import type { KnowledgeItem, KnowledgePackage } from './knowledge.contract';

const verifiedAt = '2026-08-02';
const reviewDueAt = '2026-11-02';
const jurisdiction = 'Uniunea Europeană; aplicabilitatea AETR, excluderile și derogările se verifică separat';

type SourceReference = KnowledgeItem['sourceReferences'][number];

function ref(sourceId: string, locator: string): SourceReference {
  return { sourceId, locator };
}

function item(
  id: string,
  topic: string,
  legalRule: string,
  practicalExplanation: string,
  examples: string[],
  commonMistakes: string[],
  sourceReferences: SourceReference[],
): KnowledgeItem {
  return { id, topic, legalRule, practicalExplanation, examples, commonMistakes, sourceReferences, jurisdiction, verifiedAt, reviewDueAt };
}

export const tachographKnowledgePackage: KnowledgePackage = {
  id: 'KB-LEGAL-TACH-001',
  domain: 'legislation.tachograph',
  title: 'Tahograf — utilizare, carduri și înregistrări',
  jurisdiction,
  verifiedAt,
  reviewDueAt,
  version: '0.1.1',
  status: 'published',
  sources: [
    { id: 'EU-TACH-001', title: 'Regulamentul (UE) nr. 165/2014 — consolidat la 31.12.2024', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02014R0165-20241231', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'EU-TACH-002', title: 'Comisia Europeană — Tachograph provisions Q&A', url: 'https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/tachographs/questions-and-answers-tachograph-provisions-mobility-package-1_en', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'EU-TACH-003', title: 'Regulamentul (CE) nr. 561/2006 — consolidat la 31.12.2024', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20241231', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
    { id: 'EU-TACH-004', title: 'Regulamentul de punere în aplicare (UE) 2016/799 — consolidat la 21.08.2023', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02016R0799-20230821', official: true, reachable: true, checkedAt: verifiedAt, reviewDueAt },
  ],
  items: [
    item('TACH-000', 'Domeniul de aplicare', 'Regulamentul se aplică tahografelor vehiculelor înmatriculate într-un stat membru, folosite la transport rutier supus Regulamentului 561/2006, cu excepțiile și regulile permise.', 'Verifică vehiculul, masa maximă permisă, operațiunea, înmatricularea și ruta înaintea concluziei.', ['O dată de retrofit nu se aplică automat unei operațiuni din afara domeniului.'], ['Ignorarea excluderilor, derogărilor sau regimului AETR.'], [ref('EU-TACH-001', 'art. 3'), ref('EU-TACH-003', 'art. 2–3')]),
    item('TACH-001', 'Utilizarea corectă', 'Operatorul și șoferul asigură funcționarea și utilizarea corectă; manipularea datelor este interzisă.', 'Înainte de plecare se verifică aparatul, cardul, ora, hârtia și modul selectat.', ['Card propriu introdus, oră corectă, hârtie disponibilă.'], ['Folosirea unui dispozitiv sau software care modifică ori ascunde datele.'], [ref('EU-TACH-001', 'art. 32')]),
    item('TACH-002', 'Cardul șoferului', 'Cardul propriu și valabil se folosește din momentul preluării vehiculului; o persoană nu folosește mai mult de un card valabil.', 'Cardul este personal, iar valabilitatea maximă este de cinci ani.', ['Același card personal se utilizează la schimbarea vehiculului.'], ['Introducerea după plecare, schimbul de carduri sau ignorarea expirării.'], [ref('EU-TACH-001', 'art. 26–27, art. 34(1)')]),
    item('TACH-003', 'Modurile de activitate', 'Conducerea, alte activități, disponibilitatea și pauza/repausul se înregistrează distinct.', 'Simbolul selectat trebuie să reflecte activitatea reală.', ['Încărcarea, actele și alimentarea sunt de regulă alte activități.'], ['Lăsarea simbolului repaus în timpul muncii ori disponibilității.'], [ref('EU-TACH-001', 'art. 34(5)')]),
    item('TACH-004', 'Intrări manuale', 'Activitățile departe de vehicul se introduc manual când aparatul nu le poate înregistra.', 'Golurile se completează cu activitatea reală, nu automat cu repaus.', ['Munca administrativă anterioară introducerii cardului se completează manual.'], ['Transformarea tuturor golurilor în repaus.'], [ref('EU-TACH-001', 'art. 34(3)')]),
    item('TACH-005', 'Țări și frontiere', 'Țara de început și sfârșit se introduce; fără smart v2, frontiera se înregistrează la prima oprire posibilă la sau după frontieră, iar pe feribot/tren la portul ori stația de sosire.', 'Oprirea pentru intrare trebuie să fie prima posibilitate sigură; smart v2 înregistrează automat trecerea.', ['Intrarea se face la prima parcare sigură după frontieră.'], ['Amânarea până la destinație deși a existat o oprire sigură.'], [ref('EU-TACH-001', 'art. 34(6)–(7)'), ref('EU-TACH-002', 'Q&A: border crossings')]),
    item('TACH-006', 'Dovezi la control', 'De la 31.12.2024 trebuie prezentate ziua curentă și precedentele 56 de zile.', 'Dovezile pot include cardul și, după caz, foi, printuri și intrări manuale; opțiunile tranzitorii nu reduc perioada juridică.', ['Înainte de cursă se verifică disponibilitatea tuturor dovezilor.'], ['Presupunerea că limita tehnică a cardului v1 reduce perioada la 28 zile.'], [ref('EU-TACH-001', 'art. 36'), ref('EU-TACH-002', 'Q&A: 56-day control period')]),
    item('TACH-007', 'Card pierdut, furat sau defect', 'Cardul defect se returnează statului reședinței; furtul se declară în statul producerii, pierderea statului emitent și celui de reședință dacă diferă; înlocuirea se cere în 7 zile.', 'Conducerea fără card este permisă cel mult 15 zile, sau strict cât este necesar revenirii vehiculului la bază dacă imposibilitatea se dovedește; se fac printuri și completări la început și sfârșit.', ['Șoferul declară situația, cere cardul în 7 zile și semnează printurile cerute.'], ['Conducerea fără declarație, cerere ori printurile de început și sfârșit.'], [ref('EU-TACH-001', 'art. 29, art. 35')]),
    item('TACH-008', 'Defecțiunea aparatului', 'Repararea se face cât mai curând; dacă vehiculul nu poate reveni la sediu în cel mult o săptămână, repararea se face pe traseu.', 'Până la reparare, șoferul consemnează identificarea și perioadele neînregistrate corect.', ['Atelier aprobat pe traseu când revenirea în termen nu este posibilă.'], ['Continuarea peste o săptămână fără reparare pe traseu.'], [ref('EU-TACH-001', 'art. 37')]),
    item('TACH-009', 'Inspecții și consumabile', 'Inspecția are loc cel puțin la doi ani; sigiliile se controlează, iar operatorul asigură foi și hârtie compatibile suficiente.', 'Verificarea consumabilelor și a sigiliilor face parte din pregătirea operațională.', ['Hârtie compatibilă de rezervă disponibilă.'], ['Plecarea fără hârtie ori intervenția neautorizată asupra sigiliilor.'], [ref('EU-TACH-001', 'art. 22–23, art. 33')]),
    item('TACH-010', 'Smart tachograph v2', 'În domeniul Regulamentului 165/2014, noile înmatriculări folosesc v2 din 21.08.2023; pentru operare în alt stat membru, retrofitul non-smart a avut termen 31.12.2024, iar smart v1 18.08.2025.', 'De la 01.07.2026, obligația relevantă acoperă și ansamblurile de peste 2,5 t în transport internațional sau cabotaj, sub rezerva excluderilor și derogărilor; termenele de retrofit sunt deja operative.', ['Se verifică aparatul, înmatricularea, masa ansamblului, ruta și tipul operațiunii.'], ['Aplicarea datelor tuturor vehiculelor indiferent de domeniu.'], [ref('EU-TACH-001', 'art. 3'), ref('EU-TACH-002', 'Q&A: smart tachograph v2 and retrofit'), ref('EU-TACH-003', 'art. 2–3'), ref('EU-TACH-004', 'Annex IC')]),
  ],
  history: [
    { version: '0.1.0', changedAt: verifiedAt, author: 'Documentation Owner', summary: 'Pachet Tahograf inițial; validarea și publicarea sunt blocate.' },
    { version: '0.1.1', changedAt: verifiedAt, author: 'Documentation Owner', summary: 'Corecții Domain, Legal și QA: domeniu, card, surse consolidate, trasabilitate și paritate editorială.' },
    { version: '0.1.1', changedAt: verifiedAt, author: 'Publication Gate', summary: 'Domain, Legal și QA PASS înregistrate; publicare controlată autorizată.' },
  ],
  validation: {
    domainReviewed: true,
    legalReviewed: true,
    qaReviewed: true,
    domainValidator: 'Domain Owner — Transport rutier și tahograf',
    legalValidator: 'Agent Legal — SVC-019 Legal/Compliance',
    qaValidator: 'QA editorial independent — AGM Knowledge',
    domainReviewedAt: '2026-08-02',
    legalReviewedAt: '2026-08-02',
    qaReviewedAt: '2026-08-02',
    holdReasons: [],
    contradictions: [],
  },
};
