# AGM Technical Change Report

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
