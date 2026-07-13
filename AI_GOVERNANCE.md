# AGM AI Governance

## Purpose

Acest document definește regulile de funcționare pentru guvernanța AI în AGM.

Scopul este ca orice agent, recomandare sau decizie asistată de AI să fie:

- identificabilă;
- explicabilă;
- auditată;
- validată de Turn înainte de implementare;
- separată clar de acțiunile automate.

## Core Principle

```text
Inspector observă.
Codex implementează.
Turn validează.
Doar după validare modificările devin oficiale.
```

Niciun agent AI nu execută automat modificări operaționale, juridice, financiare sau arhitecturale fără validarea Turnului.

## Agent Responsibilities

### Inspector

Responsabilități:

- detectează riscuri tehnice, UX, juridice, operaționale sau arhitecturale;
- clasifică severitatea:
  - OK;
  - Atenție;
  - Eroare;
- emite recomandări;
- menține istoricul observațiilor;
- raportează către Turn.

Limitări:

- nu modifică sistemul;
- nu implementează cod;
- nu validează propriile recomandări;
- nu ia decizii operaționale.

### Codex

Responsabilități:

- analizează recomandările validate de Turn;
- propune soluții tehnice;
- implementează numai după aprobare;
- rulează verificări;
- actualizează documentația;
- raportează rezultatul.

Limitări:

- nu transformă recomandările Inspectorului în implementare fără validare;
- nu execută modificări automate neaprobate;
- nu schimbă arhitectura aprobată fără ordin explicit.

### Turn

Responsabilități:

- validează sau respinge recomandările;
- stabilește prioritatea;
- aprobă misiunile;
- declară etapele finalizate;
- arhivează deciziile oficiale.

### Mentor

Responsabilități:

- oferă validare strategică;
- confirmă direcții de produs;
- protejează separarea AGM Basic / AGM Premium;
- susține deciziile pe termen lung.

## Agent Registry Requirements

Fiecare agent trebuie să aibă:

- identitate unică;
- cod oficial;
- rol;
- responsabilități;
- departament responsabil;
- status;
- ultima validare;
- ultima activitate;
- fiabilitate;
- istoric al observațiilor sau validărilor relevante.

Registrul oficial este read-only în MVP.

## Recommendation Lifecycle

1. Inspector identifică o observație.
2. Inspector clasifică severitatea.
3. Inspector emite recomandarea.
4. Turn analizează recomandarea.
5. Turn aprobă, respinge sau amână.
6. Dacă este aprobată, Codex transformă recomandarea în misiune.
7. Codex implementează strict misiunea aprobată.
8. Build-ul și verificările sunt rulate.
9. Turn validează rezultatul.
10. Documentația este actualizată.
11. Etapa este arhivată.

## Severity Rules

| Severity | Meaning | Action |
| --- | --- | --- |
| OK | Sistemul funcționează în parametri validați. | Monitorizare normală. |
| Atenție | Există risc sau zonă de îmbunătățire. | Recomandare către Turn. |
| Eroare | Există problemă care poate bloca stabilitatea sau publicarea. | Prioritate ridicată, validare Turn obligatorie. |

## Audit Rules

- Fiecare recomandare importantă trebuie să fie documentată.
- Fiecare implementare trebuie să indice recomandarea sau ordinul care a generat-o.
- Fiecare etapă trebuie să aibă verificări finale.
- Fiecare etapă validată trebuie arhivată în documentație.
- Istoricul deciziilor nu se rescrie; se completează.

## Automation Policy

În AGM Basic:

- AI poate recomanda;
- AI poate explica;
- AI poate identifica riscuri;
- AI poate ajuta la redactare, traducere și analiză;
- AI nu execută decizii ireversibile.

În AGM Premium:

- automatizările vor fi proiectate separat;
- fiecare automatizare va avea reguli, limite și audit;
- Turn va valida fiecare capabilitate înainte de activare.

## Governance Rule

Orice funcție AI nouă trebuie clasificată înainte de implementare:

- AGM Basic;
- AGM Premium;
- Future Backlog.

Fără clasificare și validare, funcția nu intră în dezvoltare.
