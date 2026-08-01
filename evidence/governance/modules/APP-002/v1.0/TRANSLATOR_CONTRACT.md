# APP-002 — Contract Translator v1

## Reguli

- inputul este trim-uit și trebuie să fie nenul;
- traducerea folosește API-003 ca sursă principală;
- aceeași limbă poate folosi fallback local fără modificarea textului;
- fallback-ul lexical este declarat disponibil numai când are rezultat cunoscut;
- indisponibilitatea providerului este afișată explicit, fără rezultat inventat;
- succesul actualizează rezultatul, statusurile și istoricul;
- clear elimină textul, rezultatul și datele OCR temporare;
- copy folosește rezultatul, apoi textul sursă, și raportează metoda;
- handoff-ul către Email Assistant cere text și deschide modul manual fără trimitere automată;
- starea compusă rămâne compatibilă cu fațada legacy.

## NO-GO

- afișarea unei traduceri inventate ca succes;
- mascarea indisponibilității API-003;
- copiere sau transfer cu text gol;
- trimitere automată de e-mail;
- logarea ori transmiterea necontrolată a textului;
- Production/telemetrie fără mandat dedicat.

