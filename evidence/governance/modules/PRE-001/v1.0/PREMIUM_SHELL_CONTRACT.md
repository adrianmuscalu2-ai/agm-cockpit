# PRE-001 — Contract Premium Shell v1.0

1. Registrul de rute este sursa unică pentru maparea route ↔ Premium view.
2. View-urile și rutele canonice sunt unice.
3. Slash-ul final, query și fragment nu creează view-uri divergente.
4. Shell-ul deține layout-ul și dispatch-ul, nu starea sau deciziile modulelor.
5. PRE-008 rămâne proprietarul lifecycle-ului cursei.
6. Modulele AI neaprobate rămân dezactivate și fără capabilități.
7. Linkurile Pre/After Departure rămân entrypoint-uri externe dedicate.
8. Navigația către AGM Basic este întotdeauna disponibilă.
9. Structura utilizează landmark-uri și denumiri accesibile.

**Criteriu PASS:** rutare deterministă, layout valid, i18n complet, separare de domeniu și regresii zero.

**HOLD/NO-GO:** rută duplicată, logică de domeniu în shell, modul AI activat implicit ori mutație Production.

