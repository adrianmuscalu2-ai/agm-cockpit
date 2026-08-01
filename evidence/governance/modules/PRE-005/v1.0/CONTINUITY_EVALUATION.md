# PRE-005 — Evaluare de continuitate

## Baseline protejat

- trei agenți pentru română, germană și engleză;
- starea inițială `preparing`, `enabled: false` și capabilități active zero;
- granițe: fără modificarea Basic, corecții ascunse, apel extern sau stocare;
- confirmarea utilizatorului obligatorie;
- integrarea în PRE-002 prin politica `linguistic-agents-policy` dezactivată.

## Evoluție incrementală

A fost adăugat un workflow exclusiv pentru validare, cu cerere identificată prin fingerprint, propuneri limitate și explicate, protecția termenilor operaționali și confirmare/reject explicit. Nu există funcție de aplicare a textului.

Agenții și politica rămân dezactivate.

