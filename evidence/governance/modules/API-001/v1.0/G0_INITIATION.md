# API-001 — Deschidere dosar G0

**Modul:** API Core & Health  
**Data:** 1 august 2026  
**Principiu:** evoluție înainte de înlocuire

## Obiectiv

API-001 asigură bootstrap-ul controlat al API-ului AGM Cockpit, perimetrul HTTP comun și contractele de sănătate `live` / `ready`.

## Responsabilități

- Module Owner: API Core Owner;
- implementare și mentenanță: API Engineering;
- monitorizare: Operations Health Owner;
- QA: API QA;
- Inspector: Architecture Inspector;
- documentație: Governance Documentation;
- aprobare finală: Product Owner / Turn Commander.

## Domeniu autorizat

- formalizarea contractului API Core & Health;
- centralizarea constantelor comune existente;
- caracterizarea liveness, readiness și a perimetrului HTTP;
- teste și documentație de guvernanță.

## În afara domeniului

- deployment sau modificări Production;
- modificări ale secretelor, rutării ori bazei de date;
- telemetrie continuă OPS-005;
- schimbarea comportamentului funcțional al modulelor consumatoare.

