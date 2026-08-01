# APP-003 — Email Assistant — Dosar G0

**ID dosar:** AGM-MOD-APP-003-v1.0  
**Gate:** G0 — Intake și Evaluare de Continuitate  
**Stare:** G0 — PASS / CLOSED  
**Data deschiderii:** 1 august 2026  
**Autoritate de deschidere:** Turn Commander — Adrian  
**Prioritate oficială:** 1 din 37  
**Clasificare:** AGM Basic  
**Module Owner:** Frontend & Website Owner  

## 1. Obiectiv

Evoluția incrementală a Email Assistant fără reconstruirea funcțiilor validate. Dosarul recunoaște baseline-ul existent și pregătește numai dezvoltările noi aprobabile.

## 2. Baseline recunoscut pentru evaluare

Baseline-ul existent include:

- compunere manuală și prin șabloane;
- transfer Translator → Email Assistant;
- corectare și traducere controlată;
- dictare, semnătură și contacte;
- preview și Mail Security;
- confirmare umană obligatorie;
- handoff Browser prin `mailto:`;
- handoff Android prin `AgmEmailPlugin` și `Intent.ACTION_SENDTO`;
- expediere finalizată de utilizator în Gmail sau alt client configurat.

Handoff-ul către clientul e-mail este implementat și validat istoric. Nu intră în reconstrucție.

## 3. Scop candidat pentru dezvoltare nouă

1. Atașarea controlată a documentelor în fluxul Email Assistant.
2. WhatsApp Share către aplicația instalată, fără automatizarea expedierii.
3. Mesaje localizate și comportament sigur pentru capabilități indisponibile.
4. Teste automate și validare reală Android pentru extensiile noi.
5. Actualizarea documentației și reconcilierea Roadmap-ului cu baseline-ul real al handoff-ului e-mail.

Scopul candidat devine obligatoriu numai după aprobarea arhitecturii și mandatul G3.

## 4. În afara domeniului

- SMTP, Gmail API sau păstrarea credențialelor Gmail;
- trimiterea automată a e-mailului ori a mesajului WhatsApp;
- WhatsApp inteligent, analiză conversațională sau automatizări Premium;
- refactorizarea generală a App Shell, Contact Manager, OCR sau Translation;
- schimbări Production, publicare APK sau Google Play;
- modificarea funcțiilor istorice validate fără o neconformitate dovedită.

## 5. Roluri propuse

| Responsabilitate | Rol |
|---|---|
| Module Owner | Frontend & Website Owner |
| Product outcome | Product Owner AGM / Turn Commander interimar |
| Implementare | Frontend Experience + Atlas/Codex, exclusiv sub mandat G3 |
| Android/native | Frontend Experience / Android integration |
| Monitorizare | MON-004 Browser, MON-005 Android, MON-009 UI Live |
| Mentenanță | Frontend Experience |
| QA | agent-qa / QA & Validation — acceptare nominală necesară |
| Inspector | Chief Inspector — confirmare necesară |
| Arhitectură | Architecture Guardian |
| Documentație | Documentation Owner; AGM Chronicler pentru istoric |
| Artefacte | Version Guardian |

## 6. Dependențe

`APP-015 Platform Capabilities`, `OPS-002 Android Runtime`, `APP-004 OCR`, `APP-005 Contact Manager`, `APP-002 Translator`, `APP-006 Text Corrector`, `APP-008 I18n` și `APP-009 Storage & Offline`.

Dependențele existente sunt consumate prin contracte; dosarul APP-003 nu autorizează modificarea lor implicită. Orice schimbare necesară într-o dependență primește change record și ownerul acelei componente.

## 7. Dovezi G0

| Dovadă | Rezultat |
|---|---|
| `EMAIL_ASSISTANT_AUDIT_CORRECTION_2026-07-24.md` | confirmă handoff-ul real și controlul uman |
| `EMAIL_ASSISTANT_VALIDATION.md` | matrice practică Android/HTTPS existentă |
| `apps/web/src/mailmaster/*` | boundary de compunere, stare și security gate existent |
| `apps/web/src/native-email.ts` | contract Browser/Capacitor existent |
| `AgmEmailPlugin.java` | `ACTION_SENDTO` cu `mailto:` și erori controlate |
| SR-07B Mail controller | PASS la deschiderea G0 |
| SR-08B Mail composed state | PASS la deschiderea G0 |
| Mail translation send guard | PASS la deschiderea G0 |

## 8. Riscuri inițiale

- `ACTION_SENDTO`/`mailto:` nu transportă în mod portabil atașamente; poate fi necesar un contract nativ separat bazat pe URI securizat și grant temporar de acces.
- Partajarea WhatsApp diferă între Browser și Android și nu trebuie să selecteze sau să trimită automat destinatarul.
- Documentele pot conține date personale sau sensibile; selecția, preview-ul și durata accesului trebuie controlate.
- Roadmap-ul descrie „trimitere e-mail” ca Planned, deși handoff-ul și expedierea controlată au dovezi PASS; această discrepanță trebuie corectată documentar.
- Extensiile native pot afecta manifestul Android, provider-ele de fișiere și comportamentul altor aplicații de destinație.

## 9. Criterii de ieșire G0

- [x] modulul și prioritatea sunt identificate;
- [x] autoritatea a aprobat deschiderea dosarului;
- [x] baseline-ul și dovezile au fost inventariate;
- [x] scopul candidat și excluderile sunt definite;
- [x] dependențele și riscurile inițiale sunt identificate;
- [ ] Module Owner acceptă formal rolul și scopul candidat;
- [ ] QA confirmă reutilizarea dovezilor istorice;
- [ ] Inspector confirmă Evaluarea de Continuitate;
- [ ] Product Owner aprobă rezultatul G0 și trecerea la G1.

## 10. Verdict curent

`G0 — PASS / CLOSED — G1 OPEN FOR DESIGN`

Confirmările Module Owner, QA, Inspector și Product Owner au fost consemnate. G0 este închis cu PASS, iar G1 este deschis pentru proiectare.

După confirmări, domeniul G1 este limitat strict la suport pentru atașamente, WhatsApp Share controlat, contractele necesare și criteriile de validare aferente. Se interzic reconstruirea funcționalităților existente, modificarea comportamentului validat și extinderea domeniului fără aprobare operațională.

Principiu: **EVOLUȚIE ÎNAINTE DE ÎNLOCUIRE**.
