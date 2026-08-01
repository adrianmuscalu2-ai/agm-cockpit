# APP-005 — Contract Contact Manager v1

## Invariante

- este necesar cel puțin un identificator: nume, e-mail, telefon sau WhatsApp;
- e-mailul și numerele sunt validate când sunt prezente;
- câmpurile textuale sunt normalizate prin trim înainte de persistență;
- categoriile necunoscute sunt eliminate;
- ID și createdAt se păstrează la editare;
- storage corupt revine fail-safe la listă goală;
- selecția pentru e-mail cere contact existent și e-mail valid nenul;
- ștergerea și selectarea sunt acțiuni explicite ale utilizatorului.

## NO-GO

- folosirea unui contact invalid;
- selectarea automată ori trimiterea mesajului;
- expunerea contactelor în loguri;
- cloud sync, export sau telemetrie fără aprobare;
- modificări Production fără mandat.

