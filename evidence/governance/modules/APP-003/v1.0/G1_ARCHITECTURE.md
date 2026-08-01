# APP-003 — Arhitectura G1

**Stare:** INTERNALLY APPROVED FOR G2 REVIEW  
**Principiu:** evoluție înainte de înlocuire  

## Decizie

Fluxul existent fără atașamente rămâne neschimbat: Browser folosește `mailto:`, iar Android folosește `ACTION_SENDTO`. Extensia pentru atașamente este activată numai când utilizatorul selectează fișiere și numai pe Android, prin payload explicit către plugin, copiere temporară în cache, `FileProvider` și grant read-only către aplicația selectată.

WhatsApp Share este implementat ca share sheet generic, declanșat explicit după preview și confirmare. AGM nu selectează automat WhatsApp, nu selectează destinatarul și nu trimite mesajul.

## Limite

- maximum 5 fișiere;
- maximum 10 MiB per fișier și 20 MiB total;
- numele, MIME, dimensiunea și conținutul sunt validate înainte de handoff;
- fișierele sunt păstrate numai în memorie în UI și temporar în cache-ul Android;
- niciun conținut de document nu intră în loguri/monitorizare;
- Browser nu pretinde suport pentru atașamente e-mail dacă platforma nu îl poate garanta;
- orice eroare păstrează AGM responsiv și nu produce auto-send.

## Contracte

1. `MailAttachmentPayload`: `name`, `mimeType`, `size`, `base64`.
2. `AgmEmail.compose`: contractul existent plus `attachments?`; fără atașamente păstrează exact `ACTION_SENDTO`.
3. `AgmEmail.share`: `subject`, `body`, `attachments?`; pornește chooser generic prin `ACTION_SEND`/`ACTION_SEND_MULTIPLE`.
4. UI: selectare, listare, eliminare, preview, confirmare obligatorie și erori localizate.

## Rollback/disable

Eliminarea controalelor noi și ignorarea câmpului opțional `attachments` restabilește integral baseline-ul. Metoda existentă `compose` fără atașamente rămâne compatibilă.

