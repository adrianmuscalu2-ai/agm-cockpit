# AGM — Raport final SR-09G

Data: 2026-07-29

Etapă: **SR-09G — Common Transport/Ledger Numbering Characterization**

Verdict: **PASS**

## 1. Baza și obiectivul

SR-09G a fost început în baza autorizării explicite pentru următoarea sub-etapă
SR-09 și a recomandării formulate după SR-09F.

Caracterizarea comună a numerotării transport/ledger a fost extinsă fără
modificarea logicii de producție.

## 2. Comportament caracterizat

Scutul confirmă:

- ambele contoare sunt filtrate prin `companyId`;
- numărul transportului are formatul `AGM-<an>-<secvență>`;
- numărul ledger are formatul `AGM-FIN-<an>-<secvență>`;
- secvența are patru cifre;
- ambele politici folosesc comportamentul existent `count + 1`;
- pentru count `41`, rezultatele sunt `AGM-2026-0042` și
  `AGM-FIN-2026-0042`;
- eșecul numărării transportului oprește execuția înainte de create și audit;
- coliziunea numărului transportului oprește execuția înainte de audit și
  update;
- eșecurile sunt propagate prin callbackul tranzacțional existent.

SR-09G nu introduce rezervare atomică, retry, secvență de bază de date sau
schimbare de idempotency.

## 3. Fișiere afectate

Teste:

- `apps/api/test/transports.service.characterization.spec.ts`.

Documentație:

- `AGM_SR09G_TRANSPORT_NUMBERING_CHARACTERIZATION_REPORT_2026-07-29.md`.

Nu a fost modificat niciun fișier de producție. Modificările locale existente
au rămas intacte.

## 4. Abatere detectată și remediată

Prima compilare a testului a identificat un acces direct la `ledgerNumber`
incompatibil cu tipul uniune inferat al rezultatului `registerPayment`.

Etapa s-a oprit, iar aserțiunea a fost corectată exclusiv în test prin
`objectContaining`. Nu a fost modificat codul de producție. Testul țintit și
întreaga matrice au fost apoi rerulate cu rezultat **PASS**.

## 5. Validări executate

| Validare | Rezultat |
| --- | --- |
| Caracterizare țintită `TransportsService` | **PASS — 26 teste** |
| API complet | **PASS — 12 suite, 67 teste** |
| API Build / TypeScript | **PASS** |
| MC-3A complet | **PASS** |
| Import graph Web | **PASS — 156 fișiere, 0 cicluri** |
| Import graph API | **PASS — 74 fișiere, 0 cicluri** |
| Web Build | **PASS — 174 module** |
| Browser E6.3 | **PASS** |
| Browser E6.4–E6.6 | **PASS** |
| Android `testDebugUnitTest assembleDebug` | **BUILD SUCCESSFUL — 102 task-uri** |

APK-ul debug validat are `22,277,627` bytes. Nu a fost instalat niciun APK și nu
au fost modificate setările telefonului.

Build-ul Web păstrează avertismentul istoric pentru chunk-ul principal de
`525.21 kB`; acesta nu a fost introdus de SR-09G.

## 6. Regresii și contracte

Toate scuturile SR-09A–F au trecut. Nu au fost identificate regresii.

| Contract | SHA-256 |
| --- | --- |
| `transports.controller.ts` | `A5203FEB766B964F5D433EB0F984D11883C22A9D637F868D2726F3DE34B7334E` |
| `action-reason.dto.ts` | `D365C062C68226445D9C35DC0F2A938EF98808B05D27ADEBA54550099E548510` |
| `register-payment.dto.ts` | `DE1B3B156CCE776CCF94F225851CC700733A3FEAE596647005A199584725C7DD` |
| `create-transport.dto.ts` | `8A2146110A5F9CA46B96FDC43B15B8D3254FFA2ACA66D2C890ED3F55DA22525D` |
| `prisma/schema.prisma` | `BB6C3991E9C8D12640D3DC2178842886E409B7F4A5F6305B12F9808AE71A4137` |

API-ul public, DTO-urile și schema Prisma au rămas nemodificate. Producția și
infrastructura nu au fost atinse.

## 7. SR-06, Diagnostics și materialele protejate

SR-06 rămâne **ON HOLD — Pending Final Device Validation**.

Diagnostics este neschimbat:
`258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`.

| Artefact | SHA-256 |
| --- | --- |
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| `audit_app_agmcockpit_2026-07-22.png` | `E098275C36AF0B27115FD5ED20A07C477F594737AFED74FCD5FE4666DD5B729C` |

Registrul de protecție este neschimbat:
`F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D`.

## 8. Rollback

Rollback-ul SR-09G constă exclusiv în eliminarea cazurilor de numerotare
transport adăugate în testul de caracterizare și eliminarea prezentului raport.

Nu este necesară nicio revenire în producție, baza de date sau infrastructură.

## 9. Verdict și recomandare

**SR-09G: PASS.**

Pentru următorul increment se recomandă, numai prin mandat separat, extragerea
politicii existente de formatare și numărare într-un colaborator dedicat.
Colaboratorul trebuie să păstreze exact `count + 1`, filtrele per companie și
formatele caracterizate. Orice remediere de concurență necesită mandat distinct.
