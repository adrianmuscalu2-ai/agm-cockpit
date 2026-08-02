# AGM-CHG-20260801-ACCESS-PREMIUM-001 — Inițiere

**Titlu:** Separarea Access & Entitlements de Premium Command Center  
**Data:** 1 august 2026  
**Status:** G0 PASS / G1 ARCHITECTURE READY

## Module afectate

- `API-002 — Auth & Users`: autoritatea identității și a entitlement-urilor;
- `PRE-001 — Premium Shell & Command Center`: consumator al deciziei de acces;
- `APP-001 — App Shell`: rutare și prezentare Basic/Access/Premium, fără logică de entitlement.

## Principiu

**Access decide dacă utilizatorul poate intra. Premium decide ce poate face după intrare.**

Schimbarea evoluează implementarea actuală și nu reconstruiește autentificarea, Basic sau Premium. Nu autorizează plăți, abonamente comerciale reale, migrare DB, deployment ori Production.

## Responsabilități

- Change Owner: Architecture Guardian
- API Owner: Backend & Data Custodian
- Web Owner: Frontend & Website Owner
- QA: Access Boundary QA Agent
- Inspector: Chief Architecture Inspector
- Monitorizare: MON-003 / MON-004 / MON-006 / MON-012
- Documentație: Governance Documentation Agent
- Aprobare finală: Product Owner / Turn Commander
