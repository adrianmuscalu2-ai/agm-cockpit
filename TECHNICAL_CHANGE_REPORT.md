# AGM Technical Change Report

## 2026-07-13 - AG-012.3 mandatory legal corrections

### Scope

- Implementarea cerintelor juridice obligatorii validate in AG-012.2.
- Inlocuirea elementelor juridice marcate anterior ca placeholder.
- Pastrarea arhitecturii existente fara modificari de backend, OpenAI, API, autentificare sau `.env`.

### Files Changed

- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `CHANGELOG.md`
- `TECHNICAL_CHANGE_REPORT.md`

### Implementation

- Legal Center contine acum sectiuni operationale pentru:
  - Politica de Confidentialitate;
  - Termeni si Conditii;
  - AI Transparency;
  - informarea privind microfonul;
  - Google Play Data Safety;
  - Impressum / date dezvoltator;
  - suport;
  - versiuni aplicatie / privacy / terms;
  - Open Source Licenses / Third Party Notices.
- Ecranul de prima pornire cere acceptarea informarii privind:
  - Politica de Confidentialitate;
  - Termeni si Conditii;
  - utilizarea AI;
  - utilizarea microfonului.
- Acceptarea juridica locala include:
  - `privacyPolicyVersion`;
  - `termsVersion`;
  - `acceptedAt`.
- Traducerea externa si microfonul sunt blocate pana la acceptarea informarii juridice curente.
- Sectiunea Gestionarea datelor permite stergerea locala a:
  - profilului;
  - contactelor;
  - preferintelor;
  - acceptarilor juridice;
  - tuturor datelor locale gestionate de AGM.
- A fost adaugata pagina `/licenses` pentru notificari open source si third-party.

### Security Review

- Backendul nu a fost modificat.
- Integrarea OpenAI nu a fost modificata.
- API-urile si autentificarea nu au fost modificate.
- Fisierele `.env` nu au fost modificate.
- Nu au fost introduse chei, tokenuri sau credentiale.
- Fluxurile care transmit text off-device cer acceptarea informarii juridice curente.

### Validation

- `corepack pnpm --filter @agm/web build` - passed.
- Verificare placeholder juridic: nu au ramas texte juridice de tip placeholder; aparitiile ramase sunt atribute HTML `placeholder` pentru campuri de formular.

### Remaining Decisions

- Datele oficiale de suport si identitatea completa pentru Impressum trebuie furnizate de Turn inainte de publicarea Google Play.
- URL-ul public final pentru Privacy Policy trebuie configurat in Google Play Console si, daca este necesar, indicat explicit in aplicatie.
- Build-ul de productie trebuie configurat cu backend HTTPS.

## 2026-07-13 - AG-012 Legal & Compliance preparation

### Scope

- Pregatirea infrastructurii frontend pentru publicarea AGM Translator in Google Play si pentru auditul juridic AG-012.
- Clarificarea elementelor UI care puteau induce utilizatorul in eroare in E-mail Assistant si Profil.
- Adaugarea structurii placeholder pentru Termeni, Confidentialitate, acceptare la prima pornire, Despre aplicatie, versiune si suport.

### Files Changed

- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `CHANGELOG.md`
- `TECHNICAL_CHANGE_REPORT.md`

### Implementation

- E-mail Assistant:
  - butonul de editare semnatura din E-mail Assistant este dezactivat si marcat ca functie in dezvoltare;
  - butonul `Trimite` foloseste text clar, fara simbol temporar;
  - formularea engleza `Contact agenda` a fost schimbata in `Address Book`.
- Profil:
  - adauga note vizibile ca Profilul este optional;
  - explica faptul ca datele Profilului raman locale si nu sunt exportate/transmise fara actiunea sau acordul utilizatorului;
  - marcheaza functiile lipsa ca `In dezvoltare`.
- Legal & Compliance:
  - adauga view-uri frontend `/legal` si `/about`;
  - adauga confirmare locala de test la prima pornire;
  - adauga carduri placeholder pentru Termeni, Confidentialitate, versiune, suport si audit AG-012;
  - adauga linkuri de acces in footer.

### Security Review

- Backendul nu a fost modificat.
- Integrarea OpenAI nu a fost modificata.
- Autentificarea nu a fost modificata.
- Fisierele `.env` nu au fost modificate.
- Nu au fost introduse chei, tokenuri sau credentiale.
- Confirmarea juridica implementata este marcata explicit ca test/placeholder si nu reprezinta acceptarea termenilor finali.

### Validation

- Build frontend: pending in aceasta misiune pana la rularea verificarii finale.
- QA recomandat: verificare manuala pentru `/`, `/email`, `/profile`, `/legal`, `/about` in RO / DE / EN.

### Risks

- Textele juridice finale lipsesc intentionat si trebuie completate de Agentul Juridic AG-012.
- Confirmarea de test trebuie inlocuita sau versionata cand termenii finali sunt aprobati.

### Recommendations

- Dupa auditul AG-012, completati Termenii si Politica de Confidentialitate in aceeasi infrastructura.
- Introduceti o versiune explicita pentru termenii legali finali si resetati acceptarea locala la schimbarea versiunii.
- Stabiliti datele oficiale de suport inainte de listarea Google Play.

## 2026-07-12 - AG-011-011 Text Corrector architecture

### Scope

- Proiectarea si implementarea arhitecturii frontend pentru modulul `AG-011-011 - Text Corrector`.
- Crearea punctelor de extensie pentru agentii lingvistici specializati:
  - `AG-011-011A` RO / DE Specialist;
  - `AG-011-011B` RO / EN Specialist;
  - `AG-011-011C` DE / EN Specialist.
- Integrarea modulului in Cockpit fara modificarea backendului sau a fluxurilor validate.

### Files Changed

- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `apps/web/src/text-corrector/text-corrector.types.ts`
- `apps/web/src/text-corrector/text-corrector.agents.ts`
- `apps/web/src/text-corrector/text-corrector.service.ts`
- `CHANGELOG.md`
- `TECHNICAL_CHANGE_REPORT.md`

### Architecture

- `text-corrector.types.ts` defineste contractele publice:
  - `TextCorrectorRequest`;
  - `TextCorrectorResult`;
  - `TextCorrectorAgent`;
  - modurile `correction`, `improvement`, `professional`, `simplification`;
  - sursele `translator`, `mailmaster`, `document-assistant`, `standalone`.
- `text-corrector.agents.ts` contine registry-ul agentilor specializati si logica MVP de corectare structurala.
- `text-corrector.service.ts` orchestreaza selectia agentului si expune un punct unic de intrare pentru modulele AGM.
- `main.ts` integreaza modulul ca ecran separat, ruta `/corrector`, intrare in navigare si actiuni rapide.

### Integration

- Modulul foloseste limba activa din Profil prin infrastructura existenta `uiLanguage`.
- Text Corrector poate modela sursa textului ca Translator, MailMaster, Document Assistant sau standalone.
- Fluxul oficial integrat in Translator este `Text introdus -> Corecteaza -> Tradu`.
- Actiunea `Corecteaza` din Translator ruleaza Text Corrector pe textul sursa si actualizeaza caseta sursa fara schimbarea paginii.
- Modulul `/corrector` poate aplica explicit rezultatul inapoi in Translator sau MailMaster, iar Document Assistant ramane pregatit ca punct de extensie.
- Aplicarea rezultatului este controlata de utilizator si nu suprascrie automat continutul altor module.

### Security Review

- Backendul nu a fost modificat.
- Integrarea OpenAI nu a fost modificata.
- Autentificarea si fisierele `.env` nu au fost modificate.
- Nu au fost introduse chei, tokenuri sau credentiale.

### Validation

- `corepack pnpm --filter @agm/web build` - passed.
- QA: modulul compileaza si este izolat frontend.
- UI/UX: modulul este accesibil din Cockpit si foloseste tema existenta.
- i18n: etichetele modulului sunt disponibile in RO / DE / EN.
- Architecture: agentii sunt extensibili fara schimbarea UI-ului.
- Functional: Translator are actiune directa `Corecteaza`, iar `/corrector` are handoff controlat catre Translator/MailMaster.

### Risks

- Logica lingvistica este doar MVP si nu trebuie considerata corectare profesionala completa.
- Regulile locale pot corecta doar cazuri simple; exemplele complexe necesita agenti lingvistici completi.
- Viitoarea integrare AI trebuie sa respecte Human-in-Control si minimizarea datelor.

### Recommendations

- Validarea Turnului pentru fluxul integrat `Corecteaza -> Tradu` in Translator.
- Urmatoarea etapa ar trebui sa extinda agentii cu reguli lingvistice reale si teste pe perechi RO/DE/EN.
- Agentii completi trebuie implementati prin adaptoare inlocuibile, fara dependenta directa de un provider AI.

## 2026-07-12 - Translator i18n cleanup

### Scope

- Eliminarea textelor hardcodate ramase in modulul Translator/Cockpit HUD.
- Migrarea etichetelor si statusurilor Translator in sistemul global i18n RO / DE / EN.
- Pastrarea separarii dintre Translator, Profile, MailMaster si Contact Manager.

### Files Changed

- `apps/web/src/main.ts`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `CHANGELOG.md`

### Implementation Notes

- Etichetele HUD Translator folosesc cheile `translator.*`.
- Actiunile rapide Translator folosesc cheile `translator.command.*`.
- Statusurile pentru traducere, microfon, redare vocala si curatare folosesc cheile `translator.status.*`.
- Placeholder-ul rezultatului Translator foloseste `translator.resultPlaceholder`, separat de placeholder-ul MailMaster.

### Security Review

- Backendul nu a fost modificat.
- Integrarea OpenAI nu a fost modificata.
- API-urile, autentificarea si fisierele de configurare sensibila nu au fost modificate.
- Nu au fost adaugate chei, tokenuri sau date personale.

### Validation

- `corepack pnpm --filter @agm/web build` - passed.

### Remaining Work

- Nicio restanta pentru etichetele Translator identificate in aceasta trecere.

## 2026-07-12 - Full i18n stabilization

### Scope

- Audit complet pentru Translator, Cockpit, Profil, E-mail Assistant, MailMaster, Mail Security si Contact Manager.
- Migrarea textelor UI si a statusurilor ramase in dictionarul global i18n RO / DE / EN.
- Pastrarea arhitecturii frontend existente si a separarii dintre module.

### Files Changed

- `apps/web/src/main.ts`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `apps/web/src/contact-manager/contact-manager.categories.ts`
- `apps/web/src/contact-manager/contact-manager.ui.ts`
- `apps/web/src/contact-manager/contact-manager.validation.ts`
- `apps/web/src/emailContacts.ts`
- `apps/web/src/emailTemplates.ts`
- `apps/web/src/mail-security/mail-security.policy.ts`
- `apps/web/src/mailmaster/mailmaster.compose.ts`
- `apps/web/src/mailmaster/mailmaster.salutations.ts`
- `apps/web/src/mailmaster/mailmaster.signature.ts`
- `CHANGELOG.md`

### Implementation Notes

- Headerul, navigarea, panoul de comanda si statusurile comune folosesc chei i18n.
- Profilul foloseste chei i18n pentru campuri, actiuni, explicatii, semnatura desenata si statusuri.
- E-mail Assistant foloseste chei i18n pentru comenzi, statusuri, previzualizare, semnatura si mesaje de securitate.
- Contact Manager pastreaza validarea separata de prezentare; serviciile returneaza chei stabile, iar UI-ul traduce prin dictionar.
- MailMaster foloseste dictionarul pentru salutari, follow-up, mesaj implicit, eticheta de atasamente si formule de incheiere.
- Contactele si sabloanele preinstalate pastreaza identificatori stabili; etichetele vizibile sunt rezolvate prin i18n.

### Security Review

- Backendul nu a fost modificat.
- Integrarea OpenAI nu a fost modificata.
- API-urile, autentificarea, fisierele `.env` si credentialele nu au fost modificate.
- Nu au fost adaugate chei, tokenuri sau date personale.

### Validation

- `corepack pnpm --filter @agm/web build` - passed after audit baseline.
- `corepack pnpm --filter @agm/web build` - passed after Profile/MailMaster/Contact Manager migration.
- `corepack pnpm --filter @agm/web build` - passed after preinstalled contacts/templates cleanup.

### Remaining Work

- Continutul operational al sabloanelor si frazele locale de fallback din translator raman in fisierele lor de domeniu, deoarece reprezinta date/functionare, nu etichete UI.
