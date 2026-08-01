# PRE-005 — Contract Agenți Lingvistici v1.0

1. Sunt recunoscute numai limbile RO, DE și EN.
2. Agenții sunt dezactivați și fără capabilități până la un mandat ulterior.
3. Cererea păstrează un fingerprint, nu persistă textul sursă.
4. Propunerea trebuie să corespundă cererii și limbii.
5. Sunt permise maximum 50 de schimbări, fiecare limitată, explicată și cu confidence 0–1.
6. Termenii protejați prezenți în original trebuie păstrați în înlocuire.
7. O propunere nu poate fi confirmată înainte de starea `awaiting-confirmation`.
8. Confirmarea și respingerea sunt exclusiv umane.
9. Contractul nu include o funcție de aplicare automată.
10. Textul nu este stocat și nu este trimis extern în baseline.

**Criteriu PASS:** registru unic RO/DE/EN, workflow determinist, termeni protejați, explicații și confirmare obligatorie.

**HOLD/NO-GO:** agent activ implicit, limbă/capabilitate necunoscută, termen protejat eliminat, confirmare prematură, corecție ascunsă, stocare sau apel extern.

