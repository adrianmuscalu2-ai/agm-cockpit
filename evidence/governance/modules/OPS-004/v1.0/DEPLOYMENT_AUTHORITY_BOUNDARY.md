# OPS-004 — Limita de autoritate pentru execuție

**Stare producție:** NO CHANGE  
**Deployment curent:** NO-GO / NOT AUTHORIZED

Închiderea guvernanței OPS-004 v1.0 validează procedura și testele, nu executarea lor asupra producției.

Un deployment viitor necesită cumulativ:

1. change ID și interval UTC;
2. mandat explicit de deployment/rutare;
3. identități distincte pentru Command Lead, Independent Validator, Fallback Responsible și Rollback Responsible;
4. checklist pre-change complet;
5. acces separat aprobat la secrete;
6. fallback, backup, restore rehearsal și rollback pregătite;
7. verdict GO înaintea primei mutații.

Orice element lipsă este NO-GO automat.
