# APP-013 — Contract După plecare v1

## Principii

- dacă interacțiunea nu este sigură, starea este `UNSAFE_TO_INTERACT`;
- pericolul imediat produce `EMERGENCY` și prioritate maximă;
- lipsa faptelor obligatorii împiedică o concluzie completă;
- recomandările disting acțiunile imediate, interzise, limitările și escaladarea;
- tranzițiile sunt permise numai de politica stărilor;
- evaluările repetate identice nu dublează handoff-ul;
- offline păstrează evaluarea și marchează continuitatea pentru sincronizare;
- revenirea online recuperează fluxul prin APP-014.

## Stări guvernate

`UNSAFE_TO_INTERACT`, `EMERGENCY`, `NEEDS_INFORMATION`, `ASSESSED`, `AWAITING_CONFIRMATION`, `ESCALATED`, `SAFE_TO_CONTINUE`, `CLOSED`.

## NO-GO

- recomandarea interacțiunii când condițiile sunt nesigure;
- diminuarea unui pericol imediat;
- tranziție nepermisă sau închidere inconsistentă;
- duplicarea rezultatului în Journey;
- pierderea evaluării offline;
- executarea automată a unei acțiuni externe;
- Production/telemetrie fără mandat dedicat.

