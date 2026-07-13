# AGM Release & Operations Checklist

## Purpose

Acest document definește procesul oficial AGM pentru pregătirea unei versiuni înainte de testare internă, distribuție APK sau publicare Google Play.

Scopul este ca fiecare versiune AGM să poată fi publicată prin același proces verificabil.

## Release Principle

```text
Build verificat.
Funcții testate.
Turn validează.
Documentația se actualizează.
Abia apoi versiunea se arhivează sau se publică.
```

## 1. Pre-Release Scope Check

- [ ] Versiunea are obiectiv clar.
- [ ] Funcțiile incluse sunt clasificate:
  - AGM Basic;
  - AGM Premium;
  - Future Backlog.
- [ ] Nu există funcții introduse fără aprobare Turn.
- [ ] Nu există modificări backend/API/OpenAI neaprobate.
- [ ] `.env` și secretele nu sunt modificate accidental.
- [ ] Documentația misiunii este pregătită.

## 2. Build Checklist

- [ ] `corepack pnpm --filter @agm/web build`
- [ ] `git diff --check`
- [ ] Verificare că aplicația pornește local.
- [ ] Verificare că nu apar chei i18n în UI.
- [ ] Verificare că nu există erori JavaScript vizibile în consolă.

## 3. Functional Testing

### Translator

- [ ] Text introdus manual.
- [ ] Corectare text.
- [ ] Traducere RO / DE / EN.
- [ ] Microfon.
- [ ] Redare vocală.
- [ ] Copiere rezultat.

### Camera OCR

- [ ] Permisiune cameră.
- [ ] Fotografiere/selectare imagine.
- [ ] OCR text.
- [ ] Traducere rezultat OCR.
- [ ] Copiere rezultat.
- [ ] Istoric OCR.
- [ ] Ștergere istoric OCR.

### Email Assistant / MailMaster

- [ ] Selectare contact.
- [ ] Selectare șablon.
- [ ] Îmbunătățire text.
- [ ] Traducere text.
- [ ] Copiere mesaj final.
- [ ] Semnătură.
- [ ] Funcțiile neimplementate sunt marcate clar.

### Profile

- [ ] Schimbare limbă.
- [ ] Persistență localStorage.
- [ ] Semnătură.
- [ ] Ștergere profil.

### Legal Center

- [ ] First-run acceptance.
- [ ] Privacy Policy.
- [ ] Terms.
- [ ] AI Transparency.
- [ ] Microphone disclosure.
- [ ] Camera/OCR disclosure.
- [ ] Data management.
- [ ] Third Party Notices.

### Turn Command Center

- [ ] Departamente vizibile.
- [ ] Agenți vizibili.
- [ ] Module vizibile.
- [ ] Inspector indicators OK / Atenție / Eroare.
- [ ] Raport general Inspector.
- [ ] Registru oficial agenți.
- [ ] Rapoarte read-only.

## 4. Android / APK Checklist

- [ ] `corepack pnpm --filter @agm/web exec cap sync android`
- [ ] `corepack pnpm --filter @agm/web android:apk`
- [ ] APK generat în `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] APK instalat pe Android.
- [ ] Layout verificat pe telefon.
- [ ] Camera funcționează pe telefon.
- [ ] Microfonul funcționează pe telefon.
- [ ] Redarea vocală funcționează pe telefon.
- [ ] Nu există overflow orizontal.
- [ ] Butoanele sunt ușor de apăsat.

## 5. Security and Privacy Checklist

- [ ] `.env` nu este urmărit de Git.
- [ ] Nu există chei API în frontend.
- [ ] Nu există chei API în fișiere publice.
- [ ] Nu există tokenuri/parole în commit.
- [ ] OpenAI este accesat doar prin backend.
- [ ] Datele locale pot fi șterse.
- [ ] Funcțiile AI/microfon/cameră au informări corespunzătoare.
- [ ] Politica de confidențialitate este actualizată pentru funcțiile incluse.

## 6. Google Play Checklist

- [ ] Privacy Policy URL public disponibil.
- [ ] Date oficiale suport completate.
- [ ] Data Safety actualizat.
- [ ] Permisiuni declarate:
  - Internet;
  - Microfon;
  - Cameră.
- [ ] Descriere aplicație pregătită.
- [ ] Screenshot-uri pregătite.
- [ ] Versiune aplicație verificată.
- [ ] Testare internă configurată.
- [ ] APK/AAB încărcat pentru testare.

## 7. Documentation Checklist

- [ ] `CHANGELOG.md` actualizat.
- [ ] `TECHNICAL_CHANGE_REPORT.md` actualizat.
- [ ] `ROADMAP.md` actualizat dacă prioritățile se schimbă.
- [ ] `AI_GOVERNANCE.md` actualizat dacă se schimbă reguli pentru agenți.
- [ ] `RELEASE_CHECKLIST.md` actualizat dacă procesul se schimbă.
- [ ] Deciziile importante sunt consemnate.

## 8. Archive Checklist

- [ ] Build final trecut.
- [ ] Verificări finale trecute.
- [ ] Turn a validat etapa.
- [ ] Commit creat.
- [ ] Working tree curat.
- [ ] APK păstrat pentru test, dacă etapa cere APK.
- [ ] Etapa marcată ca finalizată în documentație.

## Release Rule

Nicio versiune nu se publică sau distribuie extern fără:

- build trecut;
- checklist completat;
- validare Turn;
- verificare secrete;
- documentație actualizată.
