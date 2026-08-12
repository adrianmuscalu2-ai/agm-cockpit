# AGM Car Mover — vehicle-class domain amendment

Date: 2026-08-12  
Status: `OWNER REVIEW / AMENDMENT DELIVERED`  
Implementation status: `P0-01 — NOT STARTED`

## 1. Revised domain

AGM Car Mover manages the movement of a **Vehicle Subject on its own wheels**:

```text
CAR MOVER JOB
→ VEHICLE SUBJECT
→ PICKUP
→ DESTINATION
→ DRIVER / ASSIGNMENT
→ JOB FILE
→ TAKEOVER / HANDOVER EVIDENCE
```

Supported domain breadth includes passenger cars, light commercial vehicles, vans, trucks, tractor units and future legally drivable vehicle classes. A job is not a “car job” or “truck job” at aggregate level. It is a movement job whose subject has a class and type.

Truck subjects do not activate AGM Cockpit rules automatically. Tachograph, ADR, load-securing and freight-operation rules remain outside Car Mover unless a later, explicit Car Mover requirement introduces a narrowly defined rule.

## 2. Revised conceptual model

### CarMoverJob

Common aggregate root:

- `jobId`, tenant and product ownership;
- source/platform reference;
- pickup and destination;
- planned/actual milestones and status;
- `vehicleSubjectId`;
- driver/assignment reference;
- deadline and lifecycle version;
- audit/EventStore identifiers.

The job stores the subject reference and relevant snapshots needed for historical truth; it does not duplicate all vehicle data.

### VehicleSubject

Common identity:

- `vehicleSubjectId`;
- `vehicleClass` — stable broad category;
- `vehicleType` — extensible operational subtype;
- make/model where known;
- VIN and registration where available/applicable;
- jurisdiction/status;
- versioned `classSpecificDetails` extension object;
- document/evidence references.

Proposed conceptual `vehicleClass` vocabulary starts with:

- `PASSENGER_CAR`;
- `LIGHT_COMMERCIAL`;
- `VAN`;
- `TRUCK`;
- `TRACTOR_UNIT`;
- `OTHER_DRIVABLE_VEHICLE`.

This is an architecture vocabulary proposal, not an implemented enum. `vehicleType` remains extensible so new subtypes do not require redefining the Job aggregate.

### JobFile

A read projection combining:

- Job and Vehicle Subject summary;
- pickup/destination/assignment;
- documents and external references;
- takeover/handover protocols;
- relevant evidence;
- communications;
- costs and timeline when later authorized.

The projection must render class-specific details through adapters/sections. It must not branch the entire Job File into separate passenger-car and truck applications.

### Takeover / Handover

Common protocol envelope:

- protocol type and version;
- job and vehicle subject;
- actor, location and timestamp;
- odometer/fuel/charge where applicable;
- condition observations and exceptions;
- required document/key/accessory checklist;
- human confirmation;
- evidence and external protocol references.

Class-specific checklist fields are supplied by a versioned policy/template. Truck-specific fields remain optional extensions and are not part of P0-01.

## 3. Vehicle-class matrix

| Vehicle class | Common to all | Passenger-car specific | Light commercial / van specific | Truck / tractor-unit specific | Later without structural redesign |
|---|---|---|---|---|---|
| Passenger car | subject ID, class/type, VIN/registration when available, make/model, pickup/destination, driver assignment, condition, odometer, documents, protocol/evidence | body style, number of keys, charging cable, removable accessories | not applicable | not applicable | EV/battery fields, manufacturer metadata, class checklist versions |
| Light commercial | same common identity and job ownership | optional shared small-vehicle accessories | height/length variant, load-space access, roof equipment, commercial-use document flags | not applicable unless legally classified otherwise | dimensions/weight profile, licence category, access restrictions |
| Van | same common identity and job ownership | optional passenger configuration | seating/load-space configuration, height class, rear/side access | not applicable unless vehicle classification requires it | subtype templates, dimensions, licence requirements |
| Rigid truck | same common identity and job ownership | not applicable | some shared commercial-vehicle access fields | gross weight/dimensions, licence category, axle/body configuration, truck handover checklist, driving restrictions | regulatory profile, class-specific protocol template, optional tachograph-presence fact without Cockpit workflow |
| Tractor unit | same common identity and job ownership | not applicable | not applicable | tractor-unit distinction, coupling status, gross weight/dimensions, licence category, truck handover fields | trailer/semitrailer association, coupling protocol, restriction profile |
| Other drivable vehicle | same minimal subject/job/ownership contract | none assumed | none assumed | none assumed | new `vehicleType` and class-detail schema/template version |

### Cross-class common minimum

- vehicle subject identity;
- broad class and extensible type;
- make/model if known;
- VIN/registration if applicable;
- pickup/destination;
- driver assignment and required entitlement;
- condition and exceptions;
- documents/evidence references;
- takeover/handover confirmation;
- timeline/audit ownership.

### Candidate later attributes — not implemented

- gross weight and dimensions;
- required driving-licence category;
- special driving/access restrictions;
- truck-specific takeover/handover template;
- rigid-truck versus tractor-unit details;
- trailer/semitrailer association when the job requires it;
- EV/charging accessories and battery-state facts;
- class-specific required document policies.

All later attributes fit behind the Vehicle Subject/class-policy boundary. They do not require replacing Job, Job File or protocol ownership.

## 4. Impact on P0-01

P0-01 remains the correct first objective, with these amendments:

1. Job must reference a Vehicle Subject, not embed a passenger-car structure.
2. `vehicleClass` is mandatory in the conceptual contract.
3. `vehicleType` is an extensible value governed by a registry, not UI hardcoding.
4. unknown/not-yet-captured class details must be representable without false data.
5. Job lifecycle cannot contain passenger-car-only states.
6. Job File uses common sections plus optional class adapters.
7. protocol templates are versioned and selected by class/type when later implemented.
8. driver assignment can later validate licence category/restrictions without changing Job identity.
9. trailer/semitrailer is an optional associated subject, never an unconditional Job field.

P0-01 does **not** implement truck regulations, truck-specific UI, trailer workflows, licence validation or full handover templates. It establishes extension points and tests that a truck or tractor unit can be represented without schema abuse.

## 5. Reuse estimate impact

The vehicle-class correction does not materially reduce platform reuse:

- platform/infrastructure remains **70–78%**;
- UI/device primitives remain **60–70%**;
- operational domain reuse adjusts from **35–45%** to **33–43%** because class policies and assignment constraints require explicit adapters;
- weighted first-release reuse adjusts from **58–65%** to **57–64%**.

The small reduction buys substantially lower redesign risk. Existing `TransportJob`, lifecycle, audit and EventStore concepts remain valuable, but none may assume the subject is a passenger car.

## 6. Confirmation

- P0-01 is vehicle-class agnostic.
- Trucks and tractor units are valid future Car Mover subjects.
- Truck support is not implemented prematurely.
- AGM Cockpit truck rules are not imported automatically.
- Trailer/semitrailer support remains an optional future association.
- No schema, migration, route, UI, integration or deployment was created.

Final state: `CAR MOVER FOUNDATION AUDIT — OWNER REVIEW / AMENDMENT DELIVERED`.
