# APP-015 — Protocol de validare utilizator

**Stare solicitată:** PENDING USER VALIDATION

Validarea fizică poate fi făcută într-o sesiune scurtă pe Android:

1. Porniți aplicația și confirmați încărcarea ecranului principal.
2. Deschideți meniul administrativ și generați un raport de diagnostic; confirmați sursa `android-diagnostics`.
3. Deschideți Email Assistant și verificați că redactarea și handoff-ul e-mail funcționează neschimbat.
4. Verificați distribuirea controlată și revenirea în aplicație fără blocare.

## Criteriu de acceptare

Dacă toate cele patru verificări sunt conforme, răspunsul utilizatorului `PASS` autorizează închiderea și arhivarea oficială. Orice abatere va fi înregistrată ca incident; procesul se oprește numai dacă abaterea produce o condiție HOLD/NO-GO.
