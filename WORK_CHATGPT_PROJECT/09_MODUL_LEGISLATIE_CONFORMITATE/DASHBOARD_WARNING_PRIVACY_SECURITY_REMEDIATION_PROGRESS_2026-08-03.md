# Dashboard Warning Analysis — Privacy & Security Remediation Progress

**Data:** 2026-08-03  
**Scope:** componentă reutilizabilă de sanitizare; fără integrare Dashboard Warning  
**Stare:** `IN PROGRESS / HOLD OPEN / IMPLEMENTATION NO-GO`

## Incrementul PS-01

A fost introdusă componenta izolată
`apps/api/src/common/image-security/image-sanitizer.ts`. Componenta nu este expusă
printr-un endpoint și nu este conectată la Dashboard Warning Analysis sau providerul
Vision.

Controale implementate:

- limită input 8 MiB înainte de decodare;
- detectare JPEG/PNG/WEBP prin semnătura conținutului;
- respingerea neconcordanței dintre MIME declarat și conținut;
- decodare fail-closed cu limită de 20 megapixeli;
- limită de 8192 px pe fiecare axă;
- respingerea imaginilor multi-frame detectate;
- corectarea orientării și re-encoding canonic PNG;
- eliminarea metadata sursă prin re-encoding fără `keepMetadata`;
- coduri de eroare controlate, fără serializarea payloadului.

Dependență nouă, limitată la API: `sharp@^0.35.3`.

## Dovezi automate

Fișier: `apps/api/test/image-sanitizer.spec.ts`

| Test | Rezultat |
|---|---|
| JPEG valid cu EXIF → PNG fără EXIF/XMP/IPTC | `PASS` |
| MIME spoofing PNG declarat JPEG | `PASS` — respins |
| bytes ZIP/non-image | `PASS` — respins |
| JPEG trunchiat | `PASS` — fail-closed |
| input peste 8 MiB | `PASS` — respins înainte de decodare |
| axă peste 8192 px | `PASS` — respins |
| build API | `PASS` |

Comenzi executate:

```text
pnpm.cmd --filter @agm/api test -- --runInBand test/image-sanitizer.spec.ts
pnpm.cmd --filter @agm/api build
```

Rezultat: `6/6 tests PASS`; build `PASS`.

## Elemente încă deschise

- fixture și test polyglot dedicat;
- fixture multi-frame/animat și test explicit;
- test controlat pentru decompression bomb;
- dovadă separată pentru GPS, thumbnail și profile metadata;
- contract runtime pentru consimțământul specific și versionat;
- autentificare și throttling per actor/companie;
- propagarea anulării și cleanup verificabil;
- redacție și teste negative pentru logs/APM/traces;
- audit zero-persistence pe proxy, cache, filesystem, DB și cozi;
- dovada providerului privind retenția, regiunea și subprocessatorii.

## Verdict

Incrementul PS-01 este `PASS` în scope-ul său. Privacy & Security rămâne `HOLD`, iar
Dashboard Warning Analysis rămâne `IMPLEMENTATION NO-GO`.

## Incrementul PS-02

A fost introdusă componenta izolată
`apps/api/src/common/image-security/vision-request-security.ts`, fără integrare în
controller sau provider.

Controale implementate:

- consimțământ explicit pentru scopul `dashboard-warning-analysis`;
- versiune exactă pentru politica AGM și politica providerului;
- fereastră de valabilitate de 10 minute și toleranță viitor de maximum 60 secunde;
- respingere fail-closed pentru consimțământ absent, expirat sau incompatibil;
- eveniment de audit construit exclusiv pe allowlist;
- actor și companie pseudonimizate prin HMAC-SHA256;
- dimensiunea imaginii raportată numai ca bucket;
- interzicerea implicită a payloadului, numelui fișierului și identificatorilor bruți.

Fișier teste: `apps/api/test/vision-request-security.spec.ts`.

| Test PS-02 | Rezultat |
|---|---|
| consimțământ explicit, scop și versiuni curente | `PASS` |
| consimțământ absent | `PASS` — respins |
| versiune veche | `PASS` — respins |
| timestamp expirat sau în viitor | `PASS` — respins |
| eveniment audit fără sentinel privat | `PASS` |
| actor/companie/cheie HMAC absentă | `PASS` — fail-closed |

Validare cumulată PS-01 + PS-02: `12/12 tests PASS`; build API `PASS`.

Limită: `provider-review-required-v0.1` este o versiune provizorie de contract și nu
reprezintă dovada retenției sau aprobarea configurației providerului.

## Verdict după PS-02

PS-01 și PS-02 sunt `PASS` în scope izolat. Privacy & Security rămâne `HOLD` până
la integrarea controlată, testele end-to-end de observabilitate/cleanup/rate-limit și
dovezile externe privind providerul. Dashboard Warning Analysis rămâne `NO-GO`.

## Incrementul PS-03

A fost introdus executorul izolat
`apps/api/src/common/image-security/controlled-vision-transfer.ts`. Executorul nu
este înregistrat într-un modul Nest, nu are controller și nu este apelat de runtime.

Controale implementate:

- destinație fixă HTTPS `https://api.openai.com/v1/responses`;
- `redirect: error` pentru refuzarea redirecturilor;
- API key numai în headerul backendului;
- timeout limitat și anulare externă propagată;
- coduri de eroare controlate fără body provider, secret sau motiv brut;
- curățare în `finally` pentru succes, HTTP error, timeout și anulare;
- suprascrierea cu zero a bufferului sanitizat transferat prin ownership explicit;
- respingere înainte de provider pentru input incomplet.

Fișier teste: `apps/api/test/controlled-vision-transfer.spec.ts`.

| Test PS-03 | Rezultat |
|---|---|
| endpoint HTTPS allowlisted + redirect refuzat | `PASS` |
| succes + buffer suprascris | `PASS` |
| HTTP provider error fără secret/payload în eroare | `PASS` |
| timeout + cleanup | `PASS` |
| anulare caller + cleanup | `PASS` |
| input incomplet fără apel provider + cleanup | `PASS` |

Validare cumulată PS-01 — PS-03: `17/17 tests PASS`; build API `PASS`.

## Verdict după PS-03

PS-01, PS-02 și PS-03 sunt `PASS` în scope izolat. Rămân necesare testele
end-to-end pe stackul real de logging/APM/proxy, throttling per actor/companie,
fixture-urile adversariale rămase și dovada externă a configurației providerului.
Privacy & Security rămâne `HOLD`; Dashboard Warning Analysis rămâne `NO-GO`.

## Incrementul PS-04

Au fost adăugate contractul de rate limiting
`apps/api/src/common/image-security/vision-rate-limiter.ts` și întărirea verificării
containerelor JPEG/PNG/WEBP.

Controale implementate și testate:

- limite distincte pe actor, companie și global;
- chei actor/companie pseudonimizate cu HMAC;
- contract de store cu operație atomică `consume` pentru un viitor adaptor distribuit;
- refuz fail-closed și `retryAfterMs` pe fiecare scope;
- resetarea ferestrei fixe;
- respingerea PNG polyglot cu payload ZIP după `IEND`;
- diferențiere între container trunchiat și payload adăugat;
- verificarea lungimii RIFF pentru WEBP și a terminatorului EOI pentru JPEG.

`InMemoryVisionRateLimitStore` este admis numai pentru teste și procese unice. Nu
este un adaptor Production și nu închide cerința de contorizare distribuită.

Fișier teste nou: `apps/api/test/vision-rate-limiter.spec.ts`.

Validare cumulată PS-01 — PS-04: `23/23 tests PASS`; build API `PASS`.

În prima execuție, testul pentru JPEG trunchiat a detectat o clasificare incorectă
`IMAGE_UNSUPPORTED`. Implementarea a fost corectată pentru a returna
`IMAGE_DECODE_FAILED`, iar rerularea completă este PASS.

## Verdict după PS-04

PS-01 — PS-04 sunt `PASS` în scope izolat. Rămân deschise adaptorul atomic
distribuit, integrarea autentificată, auditul real proxy/log/APM, fixture-ul animat,
testul controlat decompression-bomb și dovezile providerului. Privacy & Security
rămâne `HOLD`; Dashboard Warning Analysis rămâne `NO-GO`.

## Incrementul PS-05

Au fost închise fixture-urile adversariale locale rămase și a fost introdus un test
automat al limitei de izolare.

Controale și dovezi:

- detectarea chunkurilor WEBP `ANIM`/`ANMF` înainte de decoder;
- respingerea unui container WEBP animat sintetic;
- PNG adversarial cu 50.000 × 50.000 pixeli declarați și CRC IHDR valid;
- respingerea PNG-ului adversarial prin limita de pixeli a decoderului;
- verificare statică: zero import filesystem, Prisma/repository sau logger liber în
  componentele Image Security;
- verificare statică: componentele nu sunt înregistrate în `AppModule` și nu există
  runtime Dashboard Warning cât timp NO-GO este activ.

Fișier test nou: `apps/api/test/image-security-boundary.spec.ts`.

Validare cumulată PS-01 — PS-05: `27/27 tests PASS`; build API `PASS`.

## Verdict după PS-05

PS-01 — PS-05 sunt `PASS` în scope local și izolat. Pentru închiderea HOLD-ului mai
sunt necesare adaptorul distribuit și integrarea autentificată într-un mediu de test
autorizat, auditul end-to-end proxy/log/APM și dovezile externe privind retenția,
regiunea și subprocessatorii providerului. Privacy & Security rămâne `HOLD`, iar
Dashboard Warning Analysis rămâne `NO-GO`.
