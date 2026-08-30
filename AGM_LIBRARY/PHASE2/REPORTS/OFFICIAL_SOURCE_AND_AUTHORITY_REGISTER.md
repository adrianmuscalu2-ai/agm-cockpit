# Official source and validation authority register

Generated: `2026-08-29`
Rule: a located candidate is not automatically current or authoritative.

This register answers the control question: “Which official/current source
supports each important AGM rule, and who may declare it valid?” Where the
current official set is incomplete, the answer remains explicitly UNKNOWN.

| Gap | Candidate sourceId(s) | Current/authority assessment | Human authority required |
|---|---|---|---|
| TACHO-001 | CS-EU-REG-561-2006<br>CS-EU-REG-561-2006-CONS-20241231 | UNKNOWN pending human verification of currentness, applicability and scope | Transport Compliance Owner (designation required) |
| TACHO-002 | CS-EU-REG-165-2014<br>CS-EU-REG-165-2014-CONS-20241231 | UNKNOWN pending human verification of currentness, applicability and scope | Transport Compliance Owner (designation required) |
| TACHO-003 | CS-EU-IMPL-REG-2016-799<br>CS-EU-IMPL-REG-2016-799-CONS-20230821 | UNKNOWN pending human verification of currentness, applicability and scope | Transport Compliance Owner (designation required) |
| TACHO-004 | CS-DE-FPERSG<br>CS-DE-FPERSV | UNKNOWN pending human verification of currentness, applicability and scope | Transport Compliance Owner (designation required) |
| TACHO-005 | CS-EU-REG-561-2006<br>CS-EU-REG-561-2006-CONS-20241231<br>CS-EU-REG-165-2014<br>CS-EU-REG-165-2014-CONS-20241231<br>CS-EU-IMPL-REG-2016-799<br>CS-EU-IMPL-REG-2016-799-CONS-20230821<br>CS-DE-FPERSG<br>CS-DE-FPERSV<br>CS-AGM-TACHO-CHANGE-MAP-V1 | UNKNOWN pending human verification of currentness, applicability and scope | Transport Compliance Owner (designation required) |
| LEGAL-001 | CS-DE-STVO | UNKNOWN pending human verification of currentness, applicability and scope | Security & Legal / Human Reviewer |
| LEGAL-002 | CS-DE-STVZO | UNKNOWN pending human verification of currentness, applicability and scope | Security & Legal / Human Reviewer |
| LEGAL-003 | CS-DE-STVO<br>CS-DE-HGB-412<br>CS-VDI-2700-HANDBOOK | PARTIAL — official candidates exist but the canonical set is incomplete | Security & Legal / Human Reviewer |
| LEGAL-004 | CS-UNECE-ADR-2025<br>CS-DE-GGVSEB | UNKNOWN pending human verification of currentness, applicability and scope | Security & Legal / Human Reviewer |
| LEGAL-005 | CS-DE-STVO<br>CS-AT-STVO-42-20260213<br>CS-CH-VRV-20220401<br>CS-FR-TRUCK-BAN-BASE-2021<br>CS-FR-TRUCK-BAN-2026<br>CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026 | UNKNOWN — complete current official source set not demonstrated | Security & Legal / Human Reviewer |
| ROUTING-TOLL-001 | CS-DE-TOLL-COLLECT-RATES<br>CS-DE-BFSTRMG<br>CS-AT-ASFINAG-GO-TOLL<br>CS-CH-BAZG-ROAD-LEVIES<br>CS-BE-VIAPASS<br>CS-PL-ETOLL-RATES<br>CS-CZ-MYTO-RATES-2026<br>CS-DK-KMTOLL-EETS<br>CS-NL-TRUCK-TOLL<br>CS-FR-MOTORWAY-TOLLS<br>CS-LU-EVIGNETTE-2019 | PARTIAL — official candidates exist but the canonical set is incomplete | Mobility & Routing Steward |
| FIELD-001 | CS-AGM-CM-FIELD-RUNBOOK-V1 | UNKNOWN pending human verification of currentness, applicability and scope | Mobility & Routing Steward |
| CAR-MOVER-001 | CS-AGM-CM-ARCH-V1 | UNKNOWN pending human verification of currentness, applicability and scope | AGM Product Owner / Car Mover Steward |
| CAR-MOVER-002 | CS-AGM-CM-JOB-V1 | UNKNOWN pending human verification of currentness, applicability and scope | AGM Product Owner / Car Mover Steward |
| DOCS-001 | CS-AGM-CM-OCR-EVIDENCE-V1 | UNKNOWN pending human verification of currentness, applicability and scope | Inspector / Evidence Custody |

## Decision boundary

- The issuing body publishes the external source.
- The named AGM human owner reviews applicability and may propose registry
  acceptance.
- Only the AGM governance decision authorized by the Owner/Inspector may mark a
  reviewed candidate `CURRENT` or `AUTHORITATIVE`.
- The Central Librarian and domain views may index that decision; they cannot
  create it.
