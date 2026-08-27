export type OperationalClosureSignoff = {
  owner: string;
  department: string;
  conclusion: string;
  evidence: string;
};

export type OperationalClosureRecord = {
  id: string;
  incidentId: string;
  status: 'closed' | 'closed-with-follow-up';
  closedAt: string;
  auditReport: string;
  checkpoint: string;
  summary: string;
  lessonsLearned: string[];
  signoffs: OperationalClosureSignoff[];
  followUps: Array<{ id: string; owner: string; status: 'open' | 'closed'; condition: string }>;
};

export const operationalClosureRegistry: OperationalClosureRecord[] = [
  {
    id: 'AGM-CLOSE-20260725-001',
    incidentId: 'AGM_INTEGRITY_AUDIT_2026-07-25',
    status: 'closed-with-follow-up',
    closedAt: '2026-07-25T16:45:00+02:00',
    auditReport: 'AGM_INCIDENT_INTEGRITY_AUDIT_2026-07-25.md',
    checkpoint: 'cf54ecf2b977ad04df8fdb1e9a6a255fd1f3e73e',
    summary: 'Incidentul Docker/PostgreSQL/API a fost remediat; codul, datele și baseline-ul concursului sunt intacte, iar recuperarea automată este validată.',
    lessonsLearned: [
      'Dependențele Docker, PostgreSQL, API, Cloudflare și monitorizare trebuie validate ca lanț, nu izolat.',
      'Secretele aplicației trebuie izolate de mediul Docker Compose și nu trebuie tipărite în probe.',
      'Autostartul are nevoie de rearmare periodică, iar monitorizarea trebuie să persiste starea chiar dacă SMTP eșuează.',
      'Baseline-ul de concurs și remedierile operaționale trebuie păstrate pe referințe Git distincte și verificabile.',
      'Riscurile reziduale trebuie transferate explicit ca follow-up-uri înaintea arhivării incidentului principal.',
    ],
    signoffs: [
      { owner: 'Atlas / Agent Codex', department: 'Maintenance, Quality & Evolution', conclusion: 'Cauzele, remedierile și dovezile au fost consolidate în raportul oficial.', evidence: 'Punctele 1-5, builduri, teste, health-check-uri și persistență.' },
      { owner: 'Inspector', department: 'QA & Validation', conclusion: 'Închiderea incidentului principal este acceptată cu două follow-up-uri separate.', evidence: 'API 200, PostgreSQL healthy, regresii PASS; limitele reziduale rămân vizibile.' },
      { owner: 'AGM Chronicler', department: 'Documentation & Knowledge', conclusion: 'Cronologia, deciziile, rezoluția și lecțiile sunt consemnate fără rescrierea istoricului.', evidence: 'Raport audit, registru Turn și dosar de închidere.' },
      { owner: 'Version Custodian', department: 'Release & Operations', conclusion: 'Baseline-ul concursului este intact și separat de branch-ul remedierilor.', evidence: 'Commit 7670640a7a8cdcd49418bfc85079c33105094d78; tree 7b0a85cc83fd776ec3aaed45b9dbff95403815fb.' },
      { owner: 'Architecture Inspector', department: 'Architecture & Platform', conclusion: 'Arhitectura operațională este reconciliată cu mecanismele implementate.', evidence: 'Docker → PostgreSQL → API; Cloudflare separat; monitor și supervisor documentate.' },
      { owner: 'Release & Operations', department: 'Release & Operations', conclusion: 'Platforma activă este stabilă și capabilă de rearmare automată.', evidence: 'Autostart, monitor și Compose PASS; API local/public 200.' },
      { owner: 'Agent Legal', department: 'Security & Legal', conclusion: 'Nu există dovezi de pierdere de date, expunere de secrete sau impact juridic demonstrabil.', evidence: '.env exclus din Git; secrete absente din raport; persistență verificată.' },
    ],
    followUps: [
      { id: 'AGM-FU-20260725-CF1033', owner: 'Release & Operations', status: 'closed', condition: 'Tunel rotit, hostname mutat, patru conexiuni Hetzner și health live/ready 5/5 HTTP 200.' },
      { id: 'AGM-FU-20260725-UILIVE', owner: 'Frontend Experience / QA', status: 'closed', condition: 'UI LIVE Automation PASS integral: opt rute HTTP 200, capturi Desktop/Mobile, Android ADB și Operations Center sincronizat.' },
    ],
  },
];
