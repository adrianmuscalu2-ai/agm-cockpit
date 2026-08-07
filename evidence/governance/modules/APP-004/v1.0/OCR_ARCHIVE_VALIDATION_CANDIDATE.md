# APP-004 — Candidat raport validare arhivă OCR locală

**Data:** 2 august 2026  
**Statut:** CANDIDATE / PASS AUTOMATIZAT PARȚIAL / PORȚI PRACTICE DESCHISE

## Domeniu validat automat

- flux logic imagine sintetică → OCR utilizabil → stare editabilă → salvare locală;
- persistență după recrearea repository-ului, ca simulare de restart;
- funcționare logică offline, cu `fetch` blocat și zero apeluri observate;
- ștergere prin contractul repository, inclusiv eliminarea cheii `agm.ocr.history.v1`;
- absența conținutului OCR sintetic din logurile capturate și diagnosticul tehnic sigur;
- interdicția statică a câmpurilor private OCR în monitoring/diagnostics;
- regresia contractului APP-004 existent.

## Comenzi și criterii

Din `apps/web`:

```text
pnpm.cmd exec tsx scripts/test-app004-ocr-archive-logical-e2e.ts
pnpm.cmd exec tsx scripts/test-app004-ocr-monitoring-privacy.ts
pnpm.cmd exec tsx scripts/test-app004-ocr-contract.ts
pnpm.cmd exec tsx scripts/test-app009-storage-offline-contract.ts
```

Toate trebuie să emită `PASS`. Datele testului sunt exclusiv sintetice.

## Limitarea dovezii

Testul logic nu demonstrează comportamentul unei instanțe reale de Chromium/WebView, persistența după oprirea forțată a aplicației, comportamentul sistemului de operare la presiune de stocare, traficul nativ Capacitor sau curățarea copiilor realizate de backup-ul dispozitivului.

## Porți practice obligatorii — NEVALIDATE

### Browser — NEVALIDAT PRACTIC

Necesită sesiune reală: creare document sintetic, reload și restart browser, mod offline din DevTools, verificare Network cu zero payload OCR, ștergere și inspecție Application/Local Storage, apoi captură redactată. Verdictul rămâne **OPEN**, nu PASS.

### Android — NEVALIDAT PRACTIC

Necesită APK/dispozitiv sau emulator: captură/import sintetic, force-stop/restart, airplane mode, inspecție trafic/logcat fără conținut OCR, ștergere și verificarea storage-ului aplicației conform accesului autorizat. Verdictul rămâne **OPEN**, nu PASS.

### Privacy/logging din runtime — NEVALIDAT PRACTIC

Validatorul static și captura consolei logice sunt PASS, dar proxy/network inspection și logcat pe runtime real sunt încă necesare. Verdictul rămâne **OPEN**.

## Verdict candidat

## Runtime infrastructure check — 2026-08-02

- Capacitor Android synchronization: **PASS**; the production web bundle was
  copied successfully into the Android project.
- Android Gradle build/device validation: **OPEN**. The current environment has
  no `JAVA_HOME`, Java executable, Android SDK, or `adb`, so `assembleDebug`,
  installation, restart/offline checks, and logcat inspection cannot run here.
- Controlled Browser validation: **OPEN**. Browser discovery returned no
  connected browser backend, so capture/reopen/restart/offline/network
  interception cannot be evidenced in this session.

These are infrastructure blockers, not successful product validations. The
candidate remains **OCR ARCHIVE — PASS TEHNIC INTERMEDIAR**.

**PASS automatizat parțial. NO-GO pentru închiderea finală** până când porțile Browser, Android și inspecția runtime privacy primesc dovezi practice, QA independent și Inspector PASS.
