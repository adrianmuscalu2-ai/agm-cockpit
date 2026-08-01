# API-008 — Evaluare de continuitate

## Baseline protejat

- cele trei acțiuni API și aliasurile lor;
- JPEG/PNG/WEBP, maximum 8 MB și maximum 7 fotografii Field Test;
- throttling 10/minut pentru analyze/recommendation și 6/minut pentru Field Test;
- provider OpenAI activ numai cu secret configurat;
- timeouturi controlate și erori sanitizate;
- scheme stricte pentru analiză, recomandare și raport;
- reguli de grounding vizual, OCR confirmat și explicații.

## Evoluție incrementală

Analiza vizuală retransmisă spre recomandare este acum validată și normalizată: exact categoriile `correct`, `recommendations`, `risks`, maximum 20 elemente și 500 caractere per observație. Field Test retrogradează `observed` la `probable` când sursa combină fotografia cu date declarative/necunoscute.

Contractul Field Test rămâne aliniat la cele două perspective laterale obligatorii. Production și providerul real nu au fost accesate.

