# APP-009 — Contract Storage & Offline v1.0

1. Fiecare cheie AGM cunoscută are un identificator și un proprietar unic în registru.
2. Proprietarul modulului rămâne responsabil de schemă, migrare și resetare.
3. APP-009 nu modifică datele și nu ocolește repository-ul proprietarului.
4. Datele marcate offline trebuie să rămână citibile fără rețea.
5. Credențialele nu sunt declarate date offline și nu pot fi extinse prin acest contract.
6. JSON corupt este tratat de repository-urile existente prin fallback sigur.
7. Outbox-urile păstrează contractele validate de identitate, idempotency, ordering, retry și acknowledgement.
8. Orice cheie nouă necesită înscrierea în registru și aprobarea proprietarului înainte de utilizare.

**Criteriu PASS:** registru complet și fără duplicate, proprietari expliciți, baseline SR-05 și fluxuri offline/outbox fără regresii.

**HOLD/NO-GO:** cheie anonimă, duplicat, credențială declarată offline, migrare fără plan ori schimbare Production.

