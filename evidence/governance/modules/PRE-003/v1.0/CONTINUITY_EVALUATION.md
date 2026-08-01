# PRE-003 — Evaluare de continuitate

## Baseline protejat

- 5 capabilități declarate, dar active zero;
- `enabled: false` și starea inițială `disabled`;
- activare și confirmare utilizator obligatorii;
- fără ascultare continuă, apeluri externe, stocare conversație sau sfat juridic obligatoriu;
- workflow preparing/awaiting-confirmation/approved/rejected;
- politica PRE-002 `copilot-policy` dezactivată și kill switch activ.

## Evoluție incrementală

Misiunile includ referințe controlate de context și declară explicit lipsa datelor personale și efectelor externe. Aprobarea necesită permis PRE-002 valid pentru aceeași operație, modul, capabilitate și versiune de politică. Permisul este consumat la aprobare; starea coruptă, permisul greșit sau expirat rămân fail-closed.

Copilotul și politica rămân dezactivate.

