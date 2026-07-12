# AGM Technical Change Report

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
