# API-006 — Contract de trasabilitate v1

- Contract: `incidents-evidence-validation.v1`;
- versiune rapoarte: `2026.1`;
- entități: `IncidentReport`, `EvidenceMetadata`, `BusinessValidationReport`;
- acțiuni audit: creare incident, rezolvare incident, creare metadate dovadă;
- câmpuri obligatorii de corelare: `companyId`, `requestId`, `correlationId`;
- incidentele și dovezile sunt create împreună cu auditul în aceeași tranzacție;
- citirile sunt limitate la `companyId` din sesiunea autentificată;
- un incident rezolvat nu poate fi rezolvat din nou;
- recovery tehnic nu produce autovalidare umană.

## NO-GO

- acces cross-tenant;
- incident sau dovadă fără audit la finalizarea tranzacției;
- raport fără request/correlation trace;
- rezolvare repetată ori autovalidare;
- ștergere sau modificare neauditată;
- orice migrare ori mutație Production fără mandat separat.

