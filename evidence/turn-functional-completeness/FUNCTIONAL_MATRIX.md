# TURN functional matrix — Product Owner

Status curent al verdictului: `TURN FUNCTIONAL COMPLETENESS = FAIL`, `PRODUCT OWNER ACCEPTANCE = NOT GRANTED`, `FINAL_PRODUCTION_PASS = RETRACTED`.

Această matrice definește proiecția `turn-functional-overview.v2`. Valorile runtime sunt citite numai din sursele indicate, pentru tenantul Production canonic, după Owner Access. Absența rândurilor într-o sursă disponibilă înseamnă `NO_ACTIVITY`, nu `UNKNOWN`. Un registru sau un contract static nu poate produce stare runtime.

## Basic

| Zonă | Informație reală pentru Product Owner | Sursa reală | Acțiune | Ce lipsește / implementare | UNKNOWN legitim |
|---|---|---|---|---|---|
| Traducător | Rezultatul unui probe funcțional real și providerul | `TranslationService.functionalHealth` / OpenAI | Deschide `/translator`; repară providerul dacă probe-ul eșuează | Telemetria de utilizare per tenant nu există deoarece endpointul Basic nu are context de tenant | Nu; disponibilitatea este observabilă live |
| Email | conversații totale/deschise, mesaje eșuate, stare și backlog Gmail | `CommunicationConversation`, `CommunicationMessage`, `GmailPilotTelemetry` | Deschide `/email`; sincronizează/retrimite | Prima sincronizare produce `NO_ACTIVITY`, nu verde | Nu |
| Document transport | Execuții și rezultate metadata-only | `ProviderUsageEvent` | Deschide Basic și scanează | Conținutul OCR nu este colectat | Nu; zero = `NO_ACTIVITY` |
| Tahograf | Execuții și rezultate metadata-only | `ProviderUsageEvent` | Deschide `/knowledge/tahograf` | Conținutul OCR nu este colectat | Nu |
| Text bord | Execuții și rezultate metadata-only | `ProviderUsageEvent` | Deschide analiza din Basic | Conținutul OCR nu este colectat | Nu |
| Martori bord | Execuții și rezultat provider | `ProviderUsageEvent` | Deschide `/knowledge/martori-bord` | Imaginea nu este stocată în telemetrie | Nu |
| Legislație | Execuții și rezultate metadata-only | `ProviderUsageEvent` | Deschide `/knowledge/legislatie` | Conținutul OCR nu este colectat | Nu |
| Siguranța mărfii Basic | Execuții și rezultate metadata-only | `ProviderUsageEvent` | Deschide `/knowledge/ancorarea-marfii` | Conținutul OCR nu este colectat | Nu |
| OCR și istoric local | Execuții, rezultat, durată și confidence | `ProviderUsageEvent` | Deschide Camera/OCR | Imaginea și textul rămân locale | Nu |
| Ghid încărcare/ancorare | Existența referinței publicate | contractul knowledge versionat | Deschide `/legal` | Nu este și nu va fi prezentat ca runtime | Nu se aplică; `STATIC_REFERENCE` |

## Premium

| Zonă | Informație reală pentru Product Owner | Sursa reală | Acțiune | Ce lipsește / implementare | UNKNOWN legitim |
|---|---|---|---|---|---|
| Înainte de plecare | sesiuni și checklist-uri neconfirmate | `PreDepartureSession` | Deschide `/before-departure.html`; finalizează sesiunile | Zero sesiuni = `NO_ACTIVITY` | Nu |
| După plecare | evenimente sincronizate | `OperationalEventStore` | Deschide `/after-departure.html` | Zero evenimente = `NO_ACTIVITY` | Nu |
| Car Mover — planificare | joburi active și oferte `NEW` | `CarMoverJob`, `CarMoverPlatformOffer` | `/car-mover/planning` | Revizuire/alocare oferte | Nu |
| Car Mover — transfer activ | joburi active și incidente deschise | `CarMoverJob`, `IncidentReport` | `/car-mover/active-transfer` | Rezolvare incidente | Nu |
| Car Mover — finalizare | joburi și incidente deschise | aceleași surse operaționale | `/car-mover/completion-incidents` | Protocol/închidere incident | Nu |
| Car Mover — contabilitate | facturi neexportate/neînchise | `CarMoverInvoice`, `CarMoverFinancialEntry` | `/car-mover/accounting` | Export/închidere facturi | Nu |
| Car Mover — arhivă | joburi în stări finale | `CarMoverJob.currentState` | `/car-mover/archive` | Arhivarea joburilor finalizate | Nu |
| Car Mover — ghid | Existența ghidului | contract static versionat | `/car-mover/guide` | Nu este stare runtime | Nu se aplică; `STATIC_REFERENCE` |
| Comunicații | conversații, eșecuri și backlog provider | comunicații + telemetrie Gmail | `/premium/communications` | Sincronizare/retry | Nu |
| AI Friend | cereri și ultimul rezultat provider | `ProviderUsageEvent(adapterId=premium-assistant)` | `/premium/voice` | Collectorul a fost adăugat pentru succes, configurare, HTTP, răspuns gol și eroare de rețea | Nu; zero = `NO_ACTIVITY` |
| Premium Load Safety | cereri și ultimul rezultat pentru analiză/recomandare/field test | `ProviderUsageEvent(adapterId=premium-load-safety.*)` | `/premium/ladungssicherung` | Collectorul a fost adăugat la toate cele trei operații provider | Nu; zero = `NO_ACTIVITY` |
| Copilot/oportunități | oportunități disponibile/stale, verdicte, decizii umane, job links, backlog și adaptoare | Opportunity Intelligence + `LiveAdapterTelemetry` | `/premium/copilot` | Rezolvă sursele stale/backlog-ul înainte de decizie | Nu |
| Echipa Premium runtime | evenimente runtime, eșecuri și heartbeat-uri stale | `AgentRuntimeEvent`, `ComponentHeartbeat` | `/premium/team` | Investighează evenimentele FAILED și heartbeat-urile stale | Nu; zero = `NO_ACTIVITY`, registrul nu produce verde |

## Reguli de verdict

- `OPERATIONAL` cere un probe funcțional runtime real și curent.
- `OBSERVED` înseamnă că sursa persistentă conține activitate reală; nu este prezentat ca verde și nu pretinde sănătate runtime.
- `ATTENTION` cere o cauză și o acțiune concrete.
- `NO_ACTIVITY` înseamnă că sursa reală a răspuns cu zero rânduri; nu este succes operațional și nu este `UNKNOWN`.
- `STATIC_REFERENCE` confirmă numai existența unui contract/conținut, niciodată runtime.
- `UNKNOWN_LEGITIMATE` rămâne permis contractual, dar acoperirea Basic v2 are collector metadata-only și nu îl folosește pentru aceste șapte funcții.
- Endpointul nu livrează rezultate parțiale: dacă o sursă obligatorie nu poate fi citită, UI afișează `DATA UNAVAILABLE` și nu deduce stări.
- `FINAL PRODUCT PASS` poate fi acordat numai explicit de Product Owner după deployment și Browser Validation ale acestei funcționalități.
- Browser Validation se execută prin `pnpm audit:turn-functional-overview` numai după `pnpm rescue:browser-preflight`; validatorul cere `AGM_TURN_OWNER_ACCESS_TOKEN` real și nu definește route stubs, payload-uri mock sau fallback de status.
