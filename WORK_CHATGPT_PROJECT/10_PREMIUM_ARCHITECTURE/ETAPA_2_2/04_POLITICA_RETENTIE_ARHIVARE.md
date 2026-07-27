# Livrabil 4 — Politica de retenție și arhivare

## Principii

- minimizarea datelor;
- retenție determinată de clasă, scop, jurisdicție și contract;
- blocarea distrugerii când există incident, litigiu, audit sau legal hold;
- distrugere verificabilă, autorizată și jurnalizată;
- retenția metadatelor poate diferi de retenția fișierului;
- durata nu este hard-codată în module.

## Clase de politică

| Policy ID | Scop | Declanșator | Durată |
|---|---|---|---|
| RET-TRANSIENT | telemetrie/diagnostic fără valoare contractuală | `recordedAt` | configurată, scurtă |
| RET-TRIP-STANDARD | istoric operațional normal | `ARCHIVED` | configurată de Legal/Product |
| RET-SAFETY-CRITICAL | confirmări, incidente, siguranță | rezoluție/arhivare | configurată per jurisdicție |
| RET-EVIDENCE | fotografii/documente | scop închis | după tip și consimțământ |
| RET-SECURITY | acces, export, policy denial | `recordedAt` | configurată de Security |
| RET-LEGAL-HOLD | evenimente sub conservare | ridicarea holdului | fără expirare automată |

Duratele calendaristice finale sunt parametri ai `RetentionRegistry` și necesită
aprobare Legal/DPO; prezentul document nu declară termene legale universale.

## Ciclul arhivei

`HOT → WARM → COLD → ELIGIBLE_FOR_DELETION → DESTROYED`

- HOT: cursă activă și sincronizare curentă.
- WARM: cursă completată, acces operațional normal.
- COLD: cursă arhivată, read-only, acces controlat.
- ELIGIBLE: retenția a expirat și nu există hold.
- DESTROYED: payload/fișier eliminat verificabil; dovada minimă a distrugerii
  rămâne conform politicii.

## Arhivarea cursei

`ARCHIVED` este permis numai dacă:

- toate evenimentele sunt sincronizate;
- lanțul de integritate este valid;
- conflictele sunt închise;
- raportul final și manifestul de dovezi au hash;
- politica de retenție este atribuită;
- nu există `RECOVERY_REQUIRED`.
