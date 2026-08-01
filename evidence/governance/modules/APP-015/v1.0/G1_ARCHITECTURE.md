# APP-015 — Arhitectura G1

**Stare:** PASS INTERN  
**Domeniu:** registru canonic și boundary Email/Share  

## Decizie

Se introduce un registru declarativ unic al capabilităților Browser/Android și se plasează handoff-ul Email/Share în spatele unui port cu adaptoare Browser și Android. `native-email.ts` rămâne facade de compatibilitate pentru consumatorii existenți.

Nu se schimbă UI-ul, payload-ul, permisiunile sau comportamentul APP-003. Diagnostics și Clipboard sunt numai înregistrate; implementările lor validate nu sunt rescrise. Audio și Camera/OCR sunt inventariate ca boundaries existente, fără migrare în acest increment.

## Criterii

- selecția platformei este explicită și testabilă;
- nicio dependență de DOM/Capacitor în portul de domeniu;
- Browser și Android păstrează fallback-urile existente;
- registrul declară owner, adapter, permisiuni și starea boundary-ului;
- facade-ul vechi rămâne compatibil;
- zero cicluri noi de import.

## Rollback

`native-email.ts` poate reveni la implementarea inline anterioară fără schimbarea callerilor. Fișierele noi pot rămâne neutilizate până la un cleanup separat.

