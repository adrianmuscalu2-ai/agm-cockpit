# TURN functional matrix — Product Owner

Status curent al verdictului: `TURN FUNCTIONAL COMPLETENESS = FAIL`, `PRODUCT OWNER ACCEPTANCE = NOT GRANTED`, `FINAL_PRODUCTION_PASS = RETRACTED`.

Această matrice definește proiecția `turn-functional-overview.v1`. Valorile runtime sunt citite numai din sursele indicate, pentru tenantul Production canonic, după Owner Access. Absența rândurilor într-o sursă disponibilă înseamnă `NO_ACTIVITY`, nu `UNKNOWN`. Un registru sau un contract static nu poate produce stare runtime.

## Basic

| Zonă | Informație reală pentru Product Owner | Sursa reală | Acțiune | Ce lipsește / implementare | UNKNOWN legitim |
|---|---|---|---|---|---|
| Traducător | Rezultatul unui probe funcțional real și providerul | `TranslationService.functionalHealth` / OpenAI | Deschide `/translator`; repară providerul dacă probe-ul eșuează | Telemetria de utilizare per tenant nu există deoarece endpointul Basic nu are context de tenant | Nu; disponibilitatea este observabilă live |
| Email | conversații totale/deschise, mesaje eșuate, stare și backlog Gmail | `CommunicationConversation`, `CommunicationMessage`, `GmailPilotTelemetry` | Deschide `/email`; sincronizează/retrimite | Prima sincronizare produce `NO_ACTIVITY`, nu verde | Nu |
| Document transport | Utilizare/rezultat local | sesiunea efemeră a dispozitivului | Deschide Basic și scanează | Collector server-side necesită consimțământ și contract de retenție | Da — date intenționat locale |
| Tahograf | Utilizare/rezultat local | sesiunea efemeră a dispozitivului | Deschide `/knowledge/tahograf` | Același collector cu retenție explicită | Da |
| Text bord | Utilizare/rezultat local | sesiunea efemeră a dispozitivului | Deschide analiza din Basic | Același collector cu retenție explicită | Da |
| Martori bord | Utilizare/rezultat local | sesiunea efemeră / knowledge local | Deschide `/knowledge/martori-bord` | Același collector cu retenție explicită | Da |
| Legislație | Utilizare/rezultat local | motorul de reguli și knowledge local | Deschide `/knowledge/legislatie` | Collector server-side versionat | Da |
| Siguranța mărfii Basic | Utilizare/rezultat local | motorul Basic local | Deschide `/knowledge/ancorarea-marfii` | Collector server-side versionat | Da |
| OCR și istoric local | imagini/text/istoric din sesiunea curentă | repository efemer al dispozitivului | Deschide Camera/OCR | Export global interzis fără consimțământ/retenție | Da |
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

- `OPERATIONAL` cere observație runtime sau activitate persistentă reală fără semnal curent de atenție.
- `ATTENTION` cere o cauză și o acțiune concrete.
- `NO_ACTIVITY` înseamnă că sursa reală a răspuns cu zero rânduri; nu este succes operațional și nu este `UNKNOWN`.
- `STATIC_REFERENCE` confirmă numai existența unui contract/conținut, niciodată runtime.
- `UNKNOWN_LEGITIMATE` este permis numai pentru date locale/efemere fără colectare autorizată și include motivul și implementarea necesară.
- Endpointul nu livrează rezultate parțiale: dacă o sursă obligatorie nu poate fi citită, UI afișează `DATA UNAVAILABLE` și nu deduce stări.
- `FINAL PRODUCT PASS` poate fi acordat numai explicit de Product Owner după deployment și Browser Validation ale acestei funcționalități.
