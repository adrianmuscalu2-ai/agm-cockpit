# Dashboard Warning Analysis — Image Security Control Contract v0.1

**Data:** 2026-08-03  
**Autoritate:** Owner Decision — Dashboard Warning Architecture Amendment  
**Scope:** contract și acceptanță pentru închiderea HOLD-ului Privacy & Security  
**Stare:** `CONTROL CONTRACT DRAFT / IMPLEMENTATION NOT AUTHORIZED`

## 1. Scop și limită

Contractul definește controalele obligatorii dintre captura Photo First și orice apel
Vision. Nicio imagine nu poate ajunge la provider dacă o etapă obligatorie lipsește,
eșuează sau nu produce dovadă verificabilă.

Acest document nu autorizează endpointul Dashboard Warning Analysis, apeluri reale
la provider, deployment, persistența imaginilor sau modificări Production.

## 2. Invarianta de securitate

```text
PHOTO_SELECTED
→ CONSENT_CONFIRMED
→ SIZE_LIMIT_PASSED
→ SIGNATURE_VERIFIED
→ IMAGE_SAFELY_DECODED
→ PIXEL_LIMIT_PASSED
→ METADATA_REMOVED
→ SAFE_IMAGE_REENCODED
→ TRANSFER_POLICY_PASSED
→ VISION_TRANSFER_ALLOWED
→ TEMPORARY_REFERENCES_RELEASED
```

Orice abatere produce `VISION_TRANSFER_DENIED`. Fallback-ul poate oferi numai
referințe Knowledge și nu poate produce identificare, severitate sau observații
pretins vizuale.

## 3. Contractul imaginii acceptate

| Proprietate | Cerință obligatorie |
|---|---|
| Formate de intrare | JPEG, PNG sau WEBP confirmat prin conținut, nu doar MIME/extensie |
| Dimensiune upload | maximum 8 MiB |
| Număr fișiere | exact 1 pentru o analiză Dashboard Warning |
| Dimensiuni decodate | maximum 20 megapixeli și maximum 8192 px pe fiecare axă |
| Cadre | un singur cadru; imagini animate respinse |
| Decodare | decoder allowlist, cu eroare fail-closed la structură invalidă/trunchiată |
| Metadate | EXIF, XMP, IPTC, GPS, thumbnail și profile neesențiale eliminate |
| Ieșire sigură | re-encoding server-side într-un format canonic aprobat |
| MIME transmis | derivat din ieșirea re-encodată, niciodată copiat din input |
| Nume fișier | netransmis providerului și neînregistrat în loguri |
| Persistență | interzisă implicit; numai buffer temporar în memorie |

Pragurile pot fi micșorate prin decizie Security/QA. Creșterea lor necesită review
nou de threat model.

## 4. Consimțământ și transparență

Înaintea transferului, interfața trebuie să comunice concis că:

- fotografia este trimisă backendului AGM și providerului Vision aprobat;
- fotografia poate include accidental plăcuțe, VIN, locație sau persoane;
- utilizatorul trebuie să evite ori să recadreze aceste elemente când este posibil;
- analiza este orientativă și poate fi oprită înainte de trimitere;
- politica de retenție aplicabilă este accesibilă înainte de confirmare.

Confirmarea trebuie să fie explicită și asociată unei versiuni de text. Dovada
permisă este minimă și nu conține imaginea:

```ts
type VisionConsentEvidence = {
  policyVersion: string;
  consentedAt: string;
  purpose: 'dashboard-warning-analysis';
  providerPolicyVersion: string;
};
```

Consimțământul general al aplicației nu substituie această confirmare specifică.

## 5. Contractul transferului

- numai HTTPS către endpointul AGM configurat și allowlisted;
- CORS nu este tratat drept mecanism de autentificare;
- endpointul cere identitatea actorului înainte de consumarea bugetului Vision;
- limitare per actor și companie, plus limită globală de protecție;
- niciun redirect către origine neaprobată;
- timeout și anulare propagate către apelul providerului;
- request body, multipart body, buffer și base64 marcate `never-log`;
- răspunsul providerului este validat structural înainte de utilizare;
- providerul primește numai imaginea re-encodată și contextul minim necesar.

## 6. Retenție și lifecycle

1. Backendul nu scrie imaginea în filesystem, bază de date, cache sau coadă.
2. Proxy-ul, APM-ul și tracing-ul nu capturează body-ul rutei.
3. Bufferul brut încetează să fie referențiat imediat după re-encoding.
4. Bufferul sigur încetează să fie referențiat în `finally`, inclusiv la timeout,
   anulare, eroare de rețea și răspuns invalid.
5. Nu se promite „ștergere fizică instantanee” a memoriei gestionate; controlul
   verificabil este absența persistenței și eliminarea referințelor.
6. Configurația și termenii providerului aplicabili mediului autorizat trebuie
   atașați ca dovadă înainte de PASS.

## 7. Logging și observabilitate

Sunt permise numai câmpuri non-payload:

- request/correlation ID;
- actor/company pseudonimizat conform politicii AGM;
- cod etapă și cod eroare;
- dimensiunea în interval/bucket, nu numele fișierului;
- latență, status HTTP și provider availability;
- versiunea contractului de control.

Sunt interzise în loguri, traces, APM, analytics și incidente:

- bytes, base64, data URL, multipart body și obiecte `File`/`Buffer`;
- numele fișierului și metadatele imaginii;
- promptul complet dacă include date furnizate de utilizator;
- răspunsul brut al providerului;
- secretul providerului și headerele de autorizare.

Mesajele de excepție externe sunt mapate la coduri controlate; obiectele arbitrare
de eroare nu sunt serializate integral.

## 8. Coduri fail-closed

| Cod | Condiție |
|---|---|
| `IMAGE_CONSENT_REQUIRED` | consimțământ absent, expirat sau versiune neacceptată |
| `IMAGE_TOO_LARGE` | input peste 8 MiB |
| `IMAGE_TYPE_MISMATCH` | MIME/extensie nu corespunde semnăturii detectate |
| `IMAGE_UNSUPPORTED` | format sau cadru neacceptat |
| `IMAGE_DECODE_FAILED` | decodare invalidă ori fișier trunchiat |
| `IMAGE_PIXEL_LIMIT_EXCEEDED` | dimensiuni decodate peste prag |
| `IMAGE_SANITIZATION_FAILED` | metadatele nu pot fi eliminate/re-encoding eșuează |
| `VISION_RATE_LIMITED` | limita actorului/companiei/globală depășită |
| `VISION_PROVIDER_UNAVAILABLE` | secret, provider sau rețea indisponibilă |
| `VISION_RESPONSE_INVALID` | schema sau post-validarea eșuează |
| `VISION_TRANSFER_DENIED` | orice stare neacoperită fail-closed |

Niciun cod nu declanșează fallback de identificare sau severitate.

## 9. Matrice de acceptanță Privacy & Security

| ID | Scenariu | Rezultat obligatoriu | Dovadă |
|---|---|---|---|
| PS-IMG-001 | JPEG valid fără metadata | re-encoded și acceptat | test buffer-to-buffer |
| PS-IMG-002 | MIME JPEG, bytes executabil/ZIP | respins type mismatch | test automat |
| PS-IMG-003 | fișier polyglot | respins | fixture adversarial versionat |
| PS-IMG-004 | imagine trunchiată | decode failed | test automat |
| PS-IMG-005 | decompression bomb / >20 MP | respins înainte de Vision | test limită |
| PS-IMG-006 | GIF/WebP animat | respins | test cadre |
| PS-META-001 | EXIF GPS + thumbnail | nicio metadata în ieșire | inspector metadata automat |
| PS-META-002 | nume fișier cu date personale | numele absent din provider/log | test negativ |
| PS-CNS-001 | fără consimțământ | transfer denied | test endpoint |
| PS-CNS-002 | versiune veche | reconfirmare obligatorie | test contract |
| PS-NET-001 | redirect extern | redirect refuzat | test client provider |
| PS-NET-002 | timeout/anulare | rezultat fail-closed + cleanup | test lifecycle |
| PS-LOG-001 | succes | zero bytes/base64/body în log/APM | scanare capturi |
| PS-LOG-002 | eroare decoder/provider | zero payload în log/APM | scanare capturi |
| PS-RET-001 | succes/eroare | zero fișier/cache/DB/coadă | audit storage |
| PS-RATE-001 | depășire per actor | 429 fără apel provider | test contorizare |
| PS-PROV-001 | configurație autorizată | regiune/retenție/subprocesatori atașați | dovadă semnată |

Toate testele sunt obligatorii. Un singur eșec păstrează HOLD-ul deschis.

## 10. Criteriu de PASS

Privacy & Security poate primi `PASS` numai dacă:

1. controalele sunt implementate într-o componentă reutilizabilă și separată de
   logica Dashboard Warning;
2. matricea de mai sus trece integral în mediul autorizat;
3. dovezile de provider, retenție, regiune și subprocessatori sunt atașate;
4. Security Governance Owner confirmă threat modelul și rezultatele;
5. review-ul nu identifică persistență sau payload privat în observabilitate.

Până atunci:

`PRIVACY & SECURITY HOLD / IMPLEMENTATION NO-GO`.
