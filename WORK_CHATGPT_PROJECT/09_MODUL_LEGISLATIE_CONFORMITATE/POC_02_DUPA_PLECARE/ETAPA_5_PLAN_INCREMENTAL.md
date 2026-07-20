# ETAPA 5 – PLAN INCREMENTAL

**Data:** 2026-07-20
**Statut:** APROBAT DOCUMENTAR – NICIUN INCREMENT AUTORIZAT

## Principiu

Fiecare increment produce un singur rezultat auditabil, primește decizie
separată și este închis prin checkpoint Git înaintea începerii următorului.

## Ordinea propusă

| Increment | Obiectiv unic | Livrabil | Criterii principale | Dependență |
|---|---|---|---|---|
| I5.1 | inventar și trasabilitate | L5-01, L5-02 | AC5-01–AC5-04 | checkpoint E4 |
| I5.2 | regresie automată | L5-03 | AC5-05–AC5-07, AC5-11–AC5-13 | PASS I5.1 |
| I5.3 | validare Browser | L5-04 | AC5-08, AC5-10–AC5-13 | PASS I5.2 |
| I5.4 | validare Android | L5-05 | AC5-09–AC5-13 | PASS I5.3 |
| I5.5 | riscuri, limitări și POC 01 | L5-06, L5-07 | AC5-14–AC5-18 | PASS I5.4 |
| I5.6 | raport și decizie finală | L5-08, L5-09 | AC5-19 | PASS I5.5 |
| I5.7 | baseline și integritate, condiționat | L5-10 | AC5-20 | PASS I5.6 și autorizare |

## Porți individuale

Pentru fiecare increment:

1. scopul și fișierele sunt enumerate;
2. Product Owner autorizează explicit execuția;
3. nu se extinde scope-ul în timpul lucrului;
4. dovezile sunt atașate rezultatului;
5. se emite PASS, REMEDIERE sau OPRIRE;
6. checkpoint-ul Git include numai incrementul;
7. hash-ul este verificat și înregistrat;
8. abia apoi poate fi autorizat incrementul următor.

## Reguli pentru constatări

- lipsa unei dovezi produce NEVALIDAT, nu defect presupus;
- un defect reproductibil produce FAIL și oprește incrementul;
- remedierea devine un increment intermediar, de exemplu `I5.2-R1`;
- după remediere se repetă integral validarea afectată;
- un test manual este consemnat separat de un test automat;
- recomandările post-POC nu devin criterii obligatorii retroactiv.

## Checkpoint-uri propuse

| Increment | Convenție mesaj |
|---|---|
| I5.1 | `docs(poc02): complete stage 5 inventory` |
| I5.2 | `test(poc02): record final automated regression` |
| I5.3 | `test(poc02): validate final browser flow` |
| I5.4 | `test(poc02): validate final android flow` |
| I5.5 | `docs(poc02): close final risks and baseline review` |
| I5.6 | `docs(poc02): record stage 5 final decision` |
| I5.7 | `chore(poc02): record validated baseline integrity` |

Mesajele sunt orientative. Conținutul și aria commitului sunt autoritatea
principală.

## Statut curent

Planul incremental este validat documentar. Toate incrementările I5.1–I5.7
rămân neautorizate. Următoarea decizie posibilă este autorizarea exclusivă a
I5.1.
