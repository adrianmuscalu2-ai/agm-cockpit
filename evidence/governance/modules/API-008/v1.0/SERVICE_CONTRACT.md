# API-008 — Contract Premium Load Safety Service v1.0

1. Endpointurile acceptă numai imagini JPEG, PNG sau WEBP, maximum 8 MB fiecare.
2. Analyze și recommendation acceptă o imagine; Field Test acceptă 2–7 fotografii cu roluri unice.
3. Field Test cere `front-oblique` și `rear-oblique`.
4. Inputurile numerice și text sunt normalizate și limitate.
5. Analiza vizuală retransmisă trebuie să respecte schema exactă și limitele de volum.
6. Providerul nu este apelat fără `OPENAI_API_KEY`.
7. Timeouturile sunt limitate; erorile și logurile nu includ secretul sau imaginea.
8. Răspunsurile providerului sunt acceptate numai după JSON Schema și post-validare locală.
9. `observed` necesită sursă exclusiv vizuală; datele declarative sau OCR nu devin observații vizuale.
10. Rezultatele sunt orientative și nu produc certificare, persistență ori tranziții operaționale.

**Criteriu PASS:** limite, throttling, validări input/output, fail-closed, grounding și compatibilitate PRE-007 fără regresii.

**HOLD/NO-GO:** upload invalid, schemă invalidă, surse amestecate marcate observed, secret absent tratat fail-open, log de secret, persistență sau mutație Production.

