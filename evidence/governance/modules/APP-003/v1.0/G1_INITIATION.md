# APP-003 — Deschidere G1

**Gate:** G1 — Design  
**Data deschiderii:** 1 august 2026, Europe/Berlin  
**Predecesor:** G0 — PASS / CLOSED  
**Stare:** OPEN FOR DESIGN  
**Implementare:** AUTHORIZED AFTER INTERNAL G1/G2 ACCEPTANCE UNDER AGM-GOV-DIR-004  

## Domeniu autorizat

1. Suport pentru atașamente.
2. WhatsApp Share controlat.
3. Contractele tehnice strict necesare.
4. Scenariile și criteriile de validare pentru funcțiile noi.

## Interdicții

- reconstruirea funcționalităților existente;
- modificarea comportamentului deja validat;
- SMTP, Gmail API sau auto-send;
- WhatsApp Premium ori automatizarea destinatarului/conversației;
- extinderea domeniului fără decizie operațională;
- modificarea codului înainte de mandatul G3.

În baza `AGM-GOV-DIR-004`, mandatul intern poate fi emis fără confirmare umană intermediară după închiderea G1 și G2 fără HOLD/NO-GO. Modulul nu poate fi închis definitiv; starea finală de predare este `PENDING USER VALIDATION`.

## Livrabile G1

- arhitectura opțiunilor și decizia recomandată;
- Interface Control Records pentru atașamente și WhatsApp Share;
- modelul de securitate, privacy și acces temporar la fișiere;
- comportamente Browser/Android și fallback-uri;
- matricea cerințe–riscuri–teste;
- planul incremental, rollback/disable și criteriile de ieșire G1.

Principiu: **EVOLUȚIE ÎNAINTE DE ÎNLOCUIRE**.
