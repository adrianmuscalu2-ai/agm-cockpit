# TURN Infrastructure Reuse Report Contract v1

Status: **APPROVED / ACTIVE**  
Owner decision: **2026-08-02**  
Accountable: **Chief Inspector**  
Executor: **Infrastructure Reuse Coordinator**  
Mode: **read-only**

## 1. Scop

Raportul este poarta obligatorie anterioară proiectării unei funcții noi sau unei
extinderi materiale. El demonstrează dacă TURN conține deja fundația necesară și
previne departamentele, agenții, serviciile, contractele și registrele paralele.

## 2. Surse obligatorii

Coordinatorul verifică, în ordinea de precedență activă:

1. mandatul Ownerului / Turn Commanderului;
2. Contractul Organizațional AGM;
3. catalogul serviciilor;
4. registrele departamentelor și agenților;
5. Architecture Registry și Version/Artefact Registry;
6. registrul modulelor AGM Cockpit;
7. contractele, runbook-urile și rapoartele active.

Documentele `superseded`, istorice sau baseline pot furniza dovezi, dar nu pot
contrazice sursele canonice active.

## 3. Conținut obligatoriu

```text
Report ID:
Data și autor:
Propunere / modul / serviciu:
Scope verificat:
Surse canonice consultate:
Departamente existente relevante:
Agenți și roluri existente relevante:
Servicii și module reutilizabile:
Contracte și registre aplicabile:
Owner / custode / validator existenți:
Suprapuneri sau duplicate detectate:
Responsabilități demonstrabil absente:
Riscuri și contradicții:
Concluzie: FOUNDATION FOUND | FOUNDATION PARTIAL | FOUNDATION NOT FOUND
Instrucțiune către Architecture:
Destinatari: Product Owner | Architecture Guardian | Turn Commander
```

Fiecare afirmație despre existență sau absență include o referință verificabilă.

## 4. Autoritate și limite

Coordinatorul poate opri intrarea în proiectare când raportul lipsește sau când
sursele canonice nu pot fi reconciliate. Coordinatorul nu:

- implementează;
- aprobă propunerea;
- alege soluția arhitecturală;
- modifică registrele ori contractele;
- substituie Architecture Guardian, Inspectorul sau Turn Commanderul.

Contradicțiile se escaladează Chief Inspectorului și se rezolvă prin fluxul TURN.

## 5. Regula de reutilizare

`FOUNDATION FOUND` obligă reutilizarea. `FOUNDATION PARTIAL` permite numai
extinderea controlată a fundației existente. O structură nouă poate fi proiectată
doar după `FOUNDATION NOT FOUND` și autorizarea Turn Commanderului.

Raportul poate fi reutilizat pentru remedieri și mentenanță în același scope atât
timp cât nu s-au schimbat contractul, riscul, serviciul sau registrele consultate.

## 6. Research & Technology Intelligence

Research & Technology Intelligence este capabilitate în Product & Portfolio, nu
departament. Cercetarea de piață sau tehnologică poate iniția o propunere, dar nu
ocoleste această poartă și nu devine automat backlog ori implementare.
