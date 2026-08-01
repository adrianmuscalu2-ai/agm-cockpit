# PRE-003 — Contract AI Copilot v1.0

1. Copilotul și capabilitățile sunt dezactivate implicit.
2. Sunt recunoscute numai cele 5 capabilități declarate.
3. Misiunea are ID, cerere, acțiune propusă și maximum 20 referințe de context.
4. Baseline-ul respinge misiuni cu date personale sau efect extern.
5. Activarea pentru validare nu reprezintă activare operațională.
6. Aprobarea este posibilă numai din `awaiting-confirmation`.
7. Aprobarea necesită permis PRE-002 issued, neexpirat și cu policy version corectă.
8. Permisul trebuie să corespundă exact operației, modulului și capabilității.
9. Permisul este consumat la aprobare și nu poate fi reutilizat.
10. Contractul nu include execuția acțiunii, memorie sau apel provider.

**Criteriu PASS:** misiune validată, workflow determinist, confirmare umană, binding PRE-002 și permis consumat.

**HOLD/NO-GO:** capabilitate necunoscută, date personale, efect extern, aprobare prematură, permis lipsă/greșit/expirat/consumat, memorie ori apel extern.

