# APP-008 — Contract I18n v1

## Invariante

- limbile oficiale sunt `ro`, `de`, `en`;
- fiecare catalog are owner explicit și acoperă toate limbile;
- cataloagele app/premium au exact aceleași chei în fiecare limbă;
- cataloagele specializate au aceeași topologie de frunze;
- nicio valoare nu este goală;
- placeholders sunt identice cu referința română;
- interpolarea înlocuiește toate aparițiile parametrului;
- limba necunoscută cade pe română;
- cheia necunoscută rămâne vizibilă literal pentru diagnostic;
- schimbarea limbii nu modifică logica, stările sau autoritatea acțiunilor.

## NO-GO

- cheie sau placeholder lipsă într-o limbă;
- text gol ori topologie divergentă;
- fallback silențios către o valoare eronată;
- folosirea traducerii pentru a schimba sensul operațional;
- pierderea etichetelor ARIA sau a semanticii live/dialog;
- Production/telemetrie fără mandat.

