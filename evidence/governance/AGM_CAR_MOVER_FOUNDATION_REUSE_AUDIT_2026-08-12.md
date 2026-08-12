# AGM Car Mover foundation / reuse audit

Date: 2026-08-12  
Status: `CAR MOVER FOUNDATION AUDIT — OWNER REVIEW / VEHICLE-CLASS AMENDED`  
Scope: discovery, reuse audit and architecture proposal only

## Executive conclusion

AGM already contains a credible shared platform core: tenant authentication, roles, Premium access, nine-language UI, translation, OCR/import, voice/conversation boundaries, controlled communications, EventStore/outbox concepts, evidence metadata, audit, incidents, monitoring, API/Android/Web shells and a substantial transport lifecycle. Car Mover should therefore be a separate product context on the same platform, not a second platform and not a feature folder embedded into Cockpit.

Car Mover means the movement of **vehicle subjects on their own wheels**. The subject may be a passenger car, light commercial vehicle, van, truck, tractor unit or another vehicle that can legally be collected and driven. Vehicle type is an attribute of the job subject; it does not define the product.

The current tenant boundary is strong at `companyId`, but most persistent records do not contain `productId`, `moduleId` or a generalized subject/aggregate discriminator. Reusing the database unchanged would make Cockpit and Car Mover records indistinguishable inside one tenant. This is the principal architectural gap and must be solved before functional Car Mover development.

Estimated realistic reuse:

- platform/infrastructure: **70–78%**;
- UI primitives and device capabilities: **60–70%**;
- operational domain logic: **35–45%**;
- weighted first-release reuse: **58–65%**.

The earlier hypothesis of roughly 75% is credible only for infrastructure, not for the complete product.

## 1. Reuse matrix

| Capability | Classification | Evidence and required boundary |
|---|---|---|
| Authentication | REUSE WITH ADAPTATION | Shared JWT/session mechanism; token must carry or resolve product entitlements. |
| Users / tenant | REUSE AS-IS | `Company`, `User`, roles and `companyId` remain canonical tenant identity. |
| Profile | REUSE AS-IS | Shared identity/preferences; product-specific settings must be namespaced. |
| Premium entitlement | REUSE WITH ADAPTATION | Add product/module entitlement, never a global Premium boolean. |
| i18n 9/9 | REUSE AS-IS | Shared language registry and primitives; Car Mover owns its vocabulary keys. |
| Translator | REUSE AS-IS | Shared service with product context only for audit/usage policy. |
| OCR / Camera / import | SHARED CORE ONLY | Capture, validation, hash and provenance shared; extraction schemas are product-specific. |
| Voice / Talk to AGM | SHARED CORE ONLY | Shared engine; mandatory product adapter and entitlement boundary. |
| AI conversation engine | SHARED CORE ONLY | Provider/governance/history shared; prompts, retrieval and allowed actions product-specific. |
| Email preparation | REUSE WITH ADAPTATION | Shared composer and validation; job ownership and Car Mover templates are separate. |
| WhatsApp preparation | REUSE WITH ADAPTATION | Same controlled contract; separate job conversation ownership. |
| PREPARE → HUMAN CONFIRM | REUSE AS-IS | Platform safety invariant across products. |
| Offline | SHARED CORE ONLY | Connectivity/state primitives shared; projections and conflict semantics per product. |
| Outbox | SHARED CORE ONLY | One infrastructure, namespaced by product/module/aggregate. |
| Reconnect | REUSE AS-IS | Shared trigger/flush coordinator; product adapters decide eligible operations. |
| Deduplication | REUSE AS-IS | Shared idempotency contract, with product included in uniqueness scope. |
| Recovery | SHARED CORE ONLY | Recovery framework shared; Car Mover owns domain recovery decisions. |
| Evidence | REUSE WITH ADAPTATION | Metadata/hash/audit shared; add product and subject ownership. External platform photos stay referenced, not duplicated. |
| Audit | REUSE WITH ADAPTATION | Shared immutable audit; add product/module/subject dimensions. |
| Incident model | SHARED CORE ONLY | Incident mechanics shared; Cockpit and Car Mover taxonomies and owners remain separate. |
| Monitoring | REUSE WITH ADAPTATION | Shared pipeline; health cards and collectors must identify product/module/runtime. |
| Security | REUSE AS-IS | Tenant enforcement, secret policy, validation and safe rendering are platform-wide. |
| Database infrastructure | REUSE AS-IS | Same PostgreSQL/Prisma lifecycle; product isolation is logical and enforced. |
| API infrastructure | REUSE AS-IS | Same NestJS envelope, auth, request/correlation IDs and health framework. |
| Android shell | REUSE WITH ADAPTATION | Shared Capacitor/native capabilities; product navigation and entitlement select cockpit. |
| Browser/Web shell | REUSE WITH ADAPTATION | Shared shell/design primitives; Car Mover receives distinct routes and navigation. |
| Notifications | SHARED CORE ONLY | Delivery framework shared; subscriptions, templates and ownership product-specific. |
| Document storage | SHARED CORE ONLY | Storage adapter/checksum/retention shared; document types and job links product-specific. |
| Search | SHARED CORE ONLY | Shared search service/query primitives; indexes and authorization filters per product. |
| History/timeline | SHARED CORE ONLY | Event/timeline renderer shared; event definitions and projections per product. |
| Cockpit safety/driver rules | DO NOT REUSE | Truck, tachograph, ADR, load and road-control rules cannot become Car Mover rules. |
| Car Mover accounting semantics | CAR MOVER SPECIFIC | Must not be inferred from Cockpit operational status or generic UI. |
| External platform photo archive | DO NOT REUSE | Store references/protocol and exception evidence only; do not mirror entire archives by default. |

## 2. Mandatory data boundaries

Every new shared record or envelope must be attributable through:

`tenantId/companyId + productId + moduleId + subjectType + subjectId`

Additional ownership rules:

| Data | Required owner |
|---|---|
| User action | tenant + product + authenticated user |
| Job/trip | tenant + product + job aggregate |
| Vehicle | tenant + product; explicit cross-product reference only, never implicit sharing |
| Document | tenant + product + subject type/id + retention class |
| Message | tenant + product + conversation + job/case where applicable |
| Evidence | tenant + product + subject + evidence purpose/provenance |
| Financial record | tenant + product + job + immutable ledger/audit reference |

Authorization must deny by default if `productId` is absent, mismatched or not entitled. API queries, unique constraints, EventStore streams, outbox keys, search indexes, caches and object-storage keys must all include the same boundary. A tenant match alone is insufficient for cross-product access.

The existing assistant reservation for `agm-car-mover` is only a future identifier; it is not an active product or entitlement.

## 3. Car Mover functional inventory

### 1. Jobs

Manual/imported intake, source platform reference, pickup/destination, milestones, status, deadlines, planned/actual kilometres and responsible user. Existing `TransportJob` lifecycle is a useful kernel, but it requires product ownership and Car Mover-specific fields/adapters.

### 2. Vehicle subject

Class-agnostic identity with `vehicleClass`, extensible `vehicleType`, VIN, registration, make/model, current condition, relevant documents and necessary evidence/reference links. Optional class-specific attributes must be grouped in versioned details rather than expanding the common Job contract with passenger-car assumptions.

### 3. Job file

Single projection over job, vehicle, milestones, communications, documents, costs, evidence and timeline. This is a projection/read model, not a new owner of duplicated data.

### 4. Pickup / delivery handover

Versioned protocol, condition observations, exceptions, human confirmation and later signature/evidence support. External platform delivery photos remain external by default.

### 5. Communications

Job-scoped Email/WhatsApp preparation, translation, full preview and human confirmation. Real providers remain separately authorized integrations.

### 6. Platforms / orders

Source registry for Onlogist, MOCCA and future platforms; manual intake first. Direct adapters require separate capability/legal/API audits.

### 7. Costs / payments

Transport price, kilometres, fuel, tolls, other costs and payment status. Monetary changes require immutable audit and corrections/reversals, not destructive edits.

### 8. Primary accounting

Invoice metadata, supporting evidence, payment association, export/handoff status and external accounting reference. It is not a general ledger replacement.

### 9. Job analysis

Revenue, cost, margin, €/km, empty kilometres and efficiency, calculated from confirmed source data with explicit freshness.

### 10. Car Mover voice assistant

Read/query job information and prepare communications. It uses the shared conversational engine through a Car Mover adapter and never gains autonomous authority.

## 4. Priority

| Candidate | Priority | Reason |
|---|---|---|
| Jobs + lifecycle | P0 FUNDAMENTAL | Aggregate owner required by every other module; high field value and strong existing lifecycle reuse. |
| Vehicle identity | P0 FUNDAMENTAL | Required to make a transport operationally meaningful and avoid duplicated free-text identity. |
| Job file/timeline projection | P0 FUNDAMENTAL | Primary daily cockpit surface; combines existing records without duplicating ownership. |
| Manual platform/source intake | P0 FUNDAMENTAL | Enables real work without premature external integrations. |
| Pickup/delivery protocol foundation | P0 FUNDAMENTAL | Core field evidence and exception workflow. |
| Communications preparation | P1 IMPORTANT | High value, but depends on job/participant ownership and provider readiness. |
| Costs/payments | P1 IMPORTANT | Necessary for business value; requires careful monetary semantics and audit. |
| Primary accounting/export | P1 IMPORTANT | Valuable after stable jobs/costs and a defined target accounting contract. |
| Job analysis | P1 IMPORTANT | Depends on reliable actual kilometres, revenue and costs. |
| Voice assistant adapter | P1 IMPORTANT | Shared engine reuse is high, but useful context depends on P0 data. |
| Direct Onlogist/MOCCA integrations | P2 LATER | External contracts, authentication, rate limits and legal permission unknown. |
| Signatures/advanced handover evidence | P2 LATER | Requires legal/retention and identity review. |
| Automated accounting synchronization | P2 LATER | High consequence; target system and reconciliation contract required. |
| Predictive optimization/recommendations | P2 LATER | Must wait for trustworthy operational history. |

## 5. Proposed architecture

```text
SHARED AGM CORE
├── identity / tenant / product entitlements
├── i18n / translation / OCR capture primitives
├── AI provider + conversation governance
├── communication preparation + confirmation contract
├── EventStore / outbox / reconnect / dedup
├── evidence storage metadata / audit / security
├── monitoring / API / Android / Web primitives
│
├── AGM COCKPIT
│   ├── truck trip context
│   ├── pre-/after-departure situations
│   ├── truck safety, ADR, tachograph and load rules
│   └── Cockpit projections and UI
│
└── AGM CAR MOVER
    ├── job aggregate and lifecycle adapter
    ├── vehicle aggregate/reference
    ├── handover protocol
    ├── job communications and documents
    ├── costs, payments and accounting handoff
    ├── analytics projections
    └── distinct Car Mover routes, cockpit and UI
```

Shared packages expose ports/contracts, not imports from Cockpit feature folders. Cockpit and Car Mover adapters translate their domain events into shared infrastructure contracts. Neither product queries the other's tables/projections directly.

## 6. Dependencies

1. Product-aware entitlement and request context.
2. Canonical product/subject ownership contract.
3. Generalized EventStore aggregate type (currently restricted to `TripContext`).
4. Product-aware evidence, audit, communications and outbox uniqueness.
5. Car Mover job lifecycle vocabulary and invariants approved by Product Owner.
6. Vehicle identity/ownership policy.
7. Retention policy for protocols, financial records and exception evidence.
8. External platform capability audit before any connector.
9. Accounting export target and reconciliation contract before implementation.

## 7. Principal risks

- Cross-product data leakage when authorization filters only by tenant.
- Treating existing truck `TripContext` as a universal job model.
- Reusing lifecycle labels while silently changing their business meaning.
- Duplicating external photo archives and creating retention/privacy liability.
- Letting reconnect send merely prepared communications.
- Mutable financial records without reversal/audit semantics.
- Premature direct integrations creating provider lock-in.
- A shared UI becoming a monolith with conditional logic for both products.
- AI retrieval mixing Cockpit and Car Mover context.
- Search/cache/object keys omitting product ownership.

## 8. Anticipated schema changes — not applied

The following are design expectations, not authorized migrations:

- introduce canonical product entitlement/membership records;
- add `productId`, `moduleId`, `subjectType`, `subjectId` to shared audit/evidence/communication/event ownership where applicable;
- generalize EventStore aggregate type while preserving versioned Cockpit events;
- add a Car Mover job extension or separate job aggregate linked to the shared transport kernel;
- add normalized vehicle identity and job/vehicle association;
- add source-platform order reference with tenant/product/source uniqueness;
- add versioned pickup/delivery protocol and exception evidence references;
- add cost entries, payment allocations, invoice metadata and accounting-export status with reversal/audit rules;
- add product-aware search projections and retention classifications.

Do not add a single nullable `productId` column and call isolation complete. Constraints, authorization, indexes, storage keys, idempotency and migrations must be designed together.

## 9. First recommended implementation objective

**CAR MOVER P0-01 — Product boundary + class-agnostic manual Job intake/lifecycle foundation**

The first objective should not be a dashboard, voice assistant or platform connector. It should establish:

1. product-aware entitlement/request boundary;
2. canonical Car Mover Job aggregate using the validated portions of `TransportJob` lifecycle;
3. manual intake with source-platform reference;
4. a Vehicle Subject reference with required `vehicleClass` and extensible `vehicleType`;
5. pickup/destination/deadline/status fields;
6. tenant/product/job isolation tests;
7. EventStore/audit/outbox contracts for the new aggregate;
8. read-only Job File projection sufficient for the next vertical slice.

Acceptance must prove that a Car Mover user can create/read only Car Mover jobs in the entitled tenant and that Cockpit records remain inaccessible and unchanged.

## 10. Owner decisions required before implementation

- Is one company allowed to subscribe to both products under the same user identity?
- Can the same physical vehicle be explicitly linked across products, or must vehicle identities remain separate?
- Which lifecycle terms are canonical for Car Mover?
- What is the initial authoritative data source: manual entry, Onlogist export, MOCCA export or another source?
- Which accounting system receives the first export/handoff?
- What retention period applies to protocols, financial evidence and exception photographs?

No Car Mover table, migration, route, UI, external integration, message, invoice, automation or deployment was created by this audit.
