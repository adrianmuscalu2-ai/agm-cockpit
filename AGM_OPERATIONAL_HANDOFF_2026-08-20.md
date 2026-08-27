# AGM Operational Handoff — 2026-08-20

## Status rapid

API Production, CORS pentru Android și endpointul real de traducere au fost verificate PASS. APK-ul debug `1.3.0` / `versionCode 21` a fost construit și instalat pe Samsung Galaxy S25 (`SM-S931B`).

Ultimul test funcțional direct: `Guten Morgen` → `Bună dimineața`, provider `openai`, `available: true`.

## Incident și remediere

Simptomele au fost becuri roșii/oranj pe date mobile și mesajul „Translator indisponibil”.

1. ADB era disponibil, dar daemonul implicit era blocat. A fost folosit portul izolat `5038`.
2. APK-ul cerut inițial `1.3.0 / versionCode 16` a fost reinstalat cu downgrade controlat; ulterior s-a construit și instalat APK-ul remediat `versionCode 21`.
3. API Production a fost repornit prin `agm-production-api.service`, conform runbookului; nu s-a folosit Docker direct.
4. CORS pentru originul nativ Android `https://localhost` a fost verificat prin preflight și GET.
5. Health checks verificate: `health/live=200`, `health/ready=200`, `translation/health=200`.
6. Endpointul real `POST /api/v1/translation/actions/translate-text` a răspuns cu traducere validă.
7. Endpointul Guardian `security/secrets/health` rămâne protejat și poate răspunde `401`; nu este o dovadă că Internetul sau traducerea sunt offline. A fost scos din becurile publice de disponibilitate prin `config/operations-health.json`; telemetria securizată rămâne separată.
8. Datele locale ale aplicației au fost resetate controlat pentru a elimina starea WebView/Service Worker veche.

## Regresia Production identificată ulterior

Comparația topologiei connectorilor a găsit două conectări simultane la același tunnel Cloudflare `agm-api-production`: `agm-production-cloudflared.service` pe Hetzner și serviciul Windows fallback `cloudflared` pe PC. Runbookul interzice explicit această stare deoarece Cloudflare poate distribui cereri între originuri diferite. Calea Hetzner a fost păstrată, iar serviciul duplicat de pe server a fost dezactivat.

Pe PC, procesul fallback identificat este `cloudflared.exe`, PID `3504`, serviciu `cloudflared`, `Running/Automatic`. Oprirea controlată prin Service Control, PowerShell și PID țintit a fost respinsă de Windows cu `Access denied`. Aceasta este cauza rădăcină demonstrată și componenta exactă care trebuie schimbată: oprirea/dezactivarea serviciului Windows fallback, cu păstrarea exclusivă a connectorului Hetzner aprobat.

Până la aplicarea acestei schimbări nu se execută retestări LTE repetitive și nu se emite PASS.

## Remediere finală locală

La 2026-08-20, prin UAC Windows, serviciul fallback `cloudflared` de pe PC a fost oprit și setat `Disabled`; procesul nu mai există. Connectorul Hetzner Production rămâne separat și activ. După restartul aplicației cu Wi-Fi dezactivat, logurile WebView nu mai conțin erori CORS sau `Failed to fetch` pentru health endpoints.

## Arhitectură operațională

`Turn Command Center → incident routing → Release & Operations (owner) → Backend & Infrastructure (executor) → Secret & Credentials Guardian (custodie) → AGM Inspector (validator) → evidence/closure`.

Guardian nu expune valori de secrete. Ruta autorizată este wrapperul `scripts/Invoke-AGM-WithHcloudToken.ps1`, care injectează temporar tokenul în proces, execută verificarea Hetzner și îl elimină la final.

Canalul Hetzner a fost validat PASS pentru ținta verificată `167.233.237.253`; cheia temporară a fost revocată automat.

## Guvernanță și limite

- Command Lead autorizează fereastra și verdictul.
- Executorul aplică numai comenzi aprobate și păstrează rezultatele.
- Validatorul independent verifică dovezile; nu execută și nu își validează propria acțiune.
- Guardian gestionează identități/secrete fără afișarea valorilor.
- PostgreSQL, DNS/Cloudflare, schema bazei de date și alte produse nu au fost modificate în această remediere.
- Orice redeploy Production ulterior necesită mandat separat și validare independentă.

## Artefacte și dovezi

- APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- APK known-good anterior: `.tmp/AGM-Cockpit-Android-known-good-1.3.0-versionCode16.apk`
- Preflight canal: `.tmp/hetzner-automation-channel.latest.json`
- Runbook lifecycle: `deploy/production/API_LIFECYCLE_RUNBOOK.md`
- Recovery SSH: `deploy/production/SSH_ACCESS_RECOVERY.md`
- Roluri: `deploy/production/OPERATIONAL_ROLES.md`
- Incident Android/CORS: `apps/web/src/incident-journal.ts` (`AGM-INC-20260728-ANDROID-CORS`)

## Retest pentru următorul operator

1. Deblochează telefonul și lasă datele mobile active.
2. Deschide APK-ul instalat și introdu un text german.
3. Apasă `Tradu`.
4. Confirmă rezultat tradus, becurile Internet/AI Copilot/Traducere și lipsa mesajului „Translator indisponibil”.
5. Dacă apare o eroare, păstrează captura și ora exactă; nu reinstala alte versiuni înainte de colectarea logului ADB.
