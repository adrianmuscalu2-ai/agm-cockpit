# Decizie de aprobare — AGM Cockpit Governance Register v1

**ID decizie:** AGM-GOV-DEC-001  
**Registru:** AGM-GOV-REG-001 / v1.0  
**Autoritate:** Turn Commander — Adrian  
**Data efectivă:** 1 august 2026, Europe/Berlin  
**Verdict:** APPROVED / ACTIVE  

## Constatări acceptate

- Structura modulelor și responsabilitățile sunt definite.
- Ciclul de guvernanță G0–G11 este stabilit.
- Criteriile PASS și condițiile HOLD / NO-GO sunt definite.
- Interfețele și procedurile operaționale sunt documentate.
- Arhivarea și trasabilitatea sunt integrate.

## Efecte obligatorii

1. Registrul este referința oficială pentru dezvoltarea viitoare AGM Cockpit.
2. Niciun modul nu intră în implementare fără dosarul aprobat.
3. Fiecare modul parcurge G0–G11 înainte de PASS.
4. Validările tehnice istorice se păstrează, dar nu acordă automat PASS de guvernanță.
5. Registrul rămâne obligatoriu până la aprobarea unei versiuni succesoare.
6. Prezenta aprobare nu autorizează singură modificări de cod, deployment sau Production.

## Etapa următoare

Ordinea modulelor a fost validată ulterior prin `AGM-GOV-DEC-003`. G0 se deschide pentru `APP-003 — Email Assistant` printr-un dosar separat care stabilește obiectivul, ownerul, participanții, limitele și rezultatul solicitat.

## Directivă ulterioară — continuitatea dezvoltării

Modulele existente pornesc din starea tehnică dovedită și nu repetă activități deja validate. G0 include o Evaluare de Continuitate care recunoaște dovezile istorice aplicabile și identifică numai golurile de guvernanță, riscurile actuale și dezvoltările noi. Modulele noi parcurg integral G0–G11; extinderile materiale reiau ciclul de la cel mai timpuriu gate afectat.

## Integritatea arhivei

Amprenta SHA-256 a registrului activ este consemnată în `SHA256SUMS.txt` din acest dosar.
