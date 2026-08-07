import type { KnowledgeItem, KnowledgePackage } from './knowledge.contract';

const verifiedAt = '2026-08-02';
const reviewDueAt = '2026-11-02';
const jurisdiction = 'UE; SEE/Elveția pentru operațiunile acoperite de art. 2(2); AETR se verifică separat pentru operațiunile art. 2(3)';

function item(
  id: string,
  topic: string,
  legalRule: string,
  practicalExplanation: string,
  examples: readonly string[],
  commonMistakes: readonly string[],
  locator: string,
  includeCommissionGuidance = false,
): KnowledgeItem {
  return {
    id, topic, legalRule, practicalExplanation, examples, commonMistakes, jurisdiction, verifiedAt, reviewDueAt,
    sourceReferences: [
      { sourceId: 'EU-DRT-001', locator },
      ...(includeCommissionGuidance ? [{ sourceId: 'EU-DRT-003', locator: `Ghid Comisia Europeană — ${topic}` }] : []),
    ],
  };
}

export const drivingRestTimesKnowledgePackage: KnowledgePackage = {
  id: 'KB-LEGAL-DRT-001',
  domain: 'legislation.driving-rest-times',
  title: 'Timpi de conducere, pauze și odihnă',
  jurisdiction,
  verifiedAt,
  reviewDueAt,
  version: '0.1.3',
  status: 'published',
  sources: [
    {
      id: 'EU-DRT-001',
      title: 'Regulamentul (CE) nr. 561/2006 — text consolidat',
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20241231',
      official: true,
      reachable: true,
      checkedAt: verifiedAt,
      reviewDueAt,
    },
    {
      id: 'EU-DRT-003',
      title: 'Comisia Europeană — Driving & rest times',
      url: 'https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en',
      official: true,
      reachable: true,
      checkedAt: verifiedAt,
      reviewDueAt,
    },
  ],
  items: [
    item('DRT-001', 'Timp zilnic de conducere', 'Maximum 9 ore; maximum 10 ore de cel mult două ori pe săptămână.', 'Extensia la 10 ore este o limită zilnică, nu un sold de ore transferabil.', ['Luni și joi pot avea câte 10 ore.'], ['O a treia zi de 10 ore în aceeași săptămână.'], 'art. 4(i), art. 6(1)'),
    item('DRT-002', 'Timp săptămânal și bisăptămânal', 'Maximum 56 ore într-o săptămână și 90 ore în două săptămâni consecutive.', 'Ambele limite se verifică simultan.', ['56 ore urmate de cel mult 34 ore.'], ['50 + 41 ore, deși fiecare săptămână este sub 56.'], 'art. 6(2)–(3)'),
    item('DRT-003', 'Pauza după conducere', 'După cel mult 4h30: minimum 45 minute sau minimum 15 urmate de minimum 30 minute.', 'Ordinea pauzei fracționate este obligatorie.', ['2h + 15m + 2h30 + 30m.'], ['30m urmate de 15m.'], 'art. 7'),
    item('DRT-004', 'Repaus zilnic', 'Normal minimum 11 ore, normal fracționat 3 + 9 ore, redus minimum 9 ore; maximum trei reduceri între repausurile săptămânale.', 'Fereastra de 24 ore este termenul de finalizare, nu durata repausului.', ['3 ore urmate de 9 ore.'], ['Formula 5 + 7 ore.'], 'art. 4(g), art. 8(2), 8(4)'),
    item('DRT-005', 'Repaus săptămânal', 'Repausul săptămânal normal este de minimum 45 ore, iar cel redus de minimum 24 ore. În două săptămâni consecutive: două repausuri normale sau unul normal și unul redus. Repausul începe cel târziu după șase perioade de 24 ore. În transport internațional de mărfuri, două reduceri consecutive sunt permise numai dacă sunt luate în afara statului de stabilire și a statului de reședință, iar în patru săptămâni există minimum patru repausuri, dintre care două normale.', 'Repausul normal nu se efectuează în vehicul.', ['Un repaus redus și unul normal în două săptămâni.'], ['Aplicarea excepției internaționale la transport intern sau în statul de reședință.'], 'art. 4(h), art. 8(6), 8(8)'),
    item('DRT-006', 'Compensarea reducerii', 'Reducerea față de 45 ore se compensează integral, înainte de sfârșitul celei de-a treia săptămâni următoare săptămânii în cauză, atașată unui repaus de minimum 9 ore. După două reduceri consecutive permise, ambele compensări precedă următorul repaus săptămânal normal.', 'O reducere la 24 ore generează 21 ore de compensat.', ['21 ore atașate integral unui repaus eligibil.'], ['Împărțirea nepermisă, termenul vag sau uitarea compensării.'], 'art. 8(6), 8(6b), 8(7)'),
    item('DRT-007', 'Conducere în echipaj', 'Repaus zilnic de minimum 9 ore în cel mult 30 ore; după prima oră prezența celui de-al doilea șofer este obligatorie.', 'Fereastra de 30 ore nu înseamnă 30 ore de conducere.', ['Pauză de 45 minute fără asistarea șoferului activ.'], ['Înregistrarea întregii disponibilități ca pauză.'], 'art. 4(o), art. 7, art. 8(5)', true),
    item('DRT-008', 'Feribot sau tren', 'Repausul zilnic normal ori săptămânal redus poate avea maximum două întreruperi, total maximum o oră, dacă șoferul are cabină de dormit, cușetă sau pat. Pentru repausul săptămânal normal, călătoria trebuie programată pentru minimum 8 ore și șoferul trebuie să aibă acces la o cabină de dormit.', 'Derogarea nu permite efectuarea părților repausului săptămânal normal în vehicul înainte de îmbarcare sau după debarcare.', ['Două manevre care însumează sub o oră, cu facilitatea de dormit cerută.'], ['Trei întreruperi, lipsa facilității sau confundarea tipurilor de repaus.'], 'art. 8(8), art. 9(1)', true),
    item('DRT-009', 'Situații excepționale', 'Pentru a ajunge la un loc de oprire adecvat, abaterea este numai cât este necesar pentru siguranță. Separat, pentru întoarcerea acasă/centrul operațional: maximum +1 oră pentru repaus săptămânal sau +2 ore pentru repaus săptămânal normal; +2 ore cere pauză neîntreruptă de 30 minute imediat înaintea conducerii suplimentare. Toate abaterile se justifică manual, iar orice extindere a conducerii în baza art. 12 se compensează echivalent, integral, până la sfârșitul celei de-a treia săptămâni următoare. Limita de 90 ore și termenul de șase perioade de 24 ore rămân; repausul nu se scurtează.', 'Derogarea nu se planifică pentru curse obișnuite.', ['Blocaj neprevăzut documentat manual și analizat distinct după scopul derogării.'], ['Omiterea compensației, a notei manuale sau folosirea repetată.'], 'art. 12', true),
  ],
  history: [
    {
      version: '0.1.3',
      changedAt: '2026-08-02',
      author: 'Documentation Owner',
      summary: 'Corecții QA ciclul 3: locator art. 4(h), sursă expirată testată și validare strictă a datelor calendaristice/viitoare.',
    },
    {
      version: '0.1.2',
      changedAt: '2026-08-02',
      author: 'Documentation Owner',
      summary: 'Corecții Legal/QA ciclul 2: orice extensie art. 12 compensată, detalii Markdown, 45h explicit și validarea temporală/unicitatea porții.',
    },
    {
      version: '0.1.1',
      changedAt: '2026-08-02',
      author: 'Documentation Owner',
      summary: 'Corecții Domain/Legal/QA: condiții complete art. 8, 9 și 12, domeniu teritorial, trasabilitate pe articol și poartă întărită.',
    },
    {
      version: '0.1.0',
      changedAt: '2026-08-02',
      author: 'Documentation Owner',
      summary: 'Pachet inițial creat din surse UE oficiale; publicarea rămâne blocată până la Domain, Legal și QA PASS.',
    },
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
