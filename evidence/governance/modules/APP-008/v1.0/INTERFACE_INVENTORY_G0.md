# APP-008 — Inventar interfețe G0

## Cataloage și owneri

- app — app-shell;
- premium — premium-shell;
- pre-departure — APP-012;
- after-departure — APP-013.

Toate declară RO, DE și EN. APP-002, APP-003, APP-006 și celelalte suprafețe UI consumă cheile prin runtime sau cataloagele lor tipizate.

## Runtime

`t(language, key, params)` selectează limba, cade controlat pe română, apoi pe cheia literală, și înlocuiește toate aparițiile parametrilor declarați.

