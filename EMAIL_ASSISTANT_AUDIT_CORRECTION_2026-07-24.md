# Corectare constatare audit — Email Assistant

Data: 2026-07-24
Clasificare: corectare audit și regresie de prezentare
SMTP / `.env`: nu se aplică

## Concluzie corectată

Email Assistant este un flux existent și utilizat repetat pentru validarea integrată
a dictării, procesării, traducerii, pregătirii și expedierii mesajelor. Nu este o
simulare și nu depinde de SMTP configurat în AGM.

Fluxul validat este:

```text
dictare în AGM
→ procesare / traducere
→ destinatar + subiect + mesaj
→ previzualizare
→ Mail Security
→ confirmare obligatorie
→ pluginul Android AgmEmail
→ Intent.ACTION_SENDTO cu URI mailto:
→ Gmail sau alt client e-mail configurat
→ expediere confirmată de utilizator în client
→ recepție în căsuța destinatarului
```

## Delimitare tehnică

- AGM pregătește, verifică și transferă mesajul.
- Pe Android, `AgmEmailPlugin` folosește `Intent.ACTION_SENDTO` cu `mailto:`,
  destinatatar, subiect și corp.
- Gmail efectuează expedierea efectivă după acțiunea utilizatorului.
- În Browser, fallback-ul folosește un URI `mailto:`.
- Nu există și nu este necesară o integrare SMTP sau Gmail API pentru acest flux.
- AGM nu păstrează parola Gmail și nu necesită variabile SMTP în `.env`.

## Dovadă practică furnizată

Testul utilizatorului confirmă:

| Control | Rezultat |
|---|---|
| Dictare în AGM | PASS |
| Pregătire și traducere mesaj | PASS |
| Destinatar și subiect | PASS |
| Previzualizare completă | PASS |
| Confirmare obligatorie | PASS |
| Selector aplicație e-mail Android | PASS |
| Transfer AGM → Gmail | PASS |
| Expediere reală prin Gmail | PASS |
| Recepție în căsuța destinatarului | PASS |

## Corecția auditului

Textele „Trimiterea reală nu este activată” și „Confirmarea nu trimite e-mailul”
au fost incorecte pentru fluxul livrat. Ele sunt înlocuite cu explicația exactă:
după confirmare, AGM transferă mesajul către aplicația de e-mail, iar utilizatorul
finalizează expedierea în client.

Corecția nu modifică dictarea, traducerea, Mail Security, confirmarea,
`native-email.ts`, `AgmEmailPlugin.java`, configurația Android, SMTP sau `.env`.
