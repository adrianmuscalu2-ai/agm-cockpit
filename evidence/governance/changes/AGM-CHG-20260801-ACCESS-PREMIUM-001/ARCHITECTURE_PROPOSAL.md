# Propunere arhitecturală — Access separat de Premium

## 1. Componente

### Access & Entitlements (`API-002`)

Deține:

- identitatea utilizatorului;
- starea contului;
- tier-ul `basic` / `premium`;
- valabilitatea entitlement-ului;
- lista capabilităților Premium permise;
- motivul refuzului și data următoarei verificări.

Nu deține UI Premium, logică AI, module Premium sau plăți.

### Access Gateway (`APP-001`)

Deține:

- ecranul separat `/access`;
- starea vizibilă a accesului;
- rutarea către Basic, reînnoire/upgrade sau Premium;
- comportamentul fail-closed când entitlement-ul lipsește ori este invalid.

Nu emite și nu modifică entitlement-uri.

### Premium Command Center (`PRE-001`)

Deține:

- shell-ul și navigația Premium;
- catalogul modulelor Premium;
- verificarea capabilității înainte de deschiderea fiecărui modul;
- revenirea sigură la Access sau Basic.

Nu autentifică utilizatorul, nu administrează contul și nu decide planul comercial.

## 2. Flux

```text
AGM Basic
   ↓ solicitare Premium
Access Gateway
   ↓ verificare API-002
   ├─ basic / fără entitlement → Access: prezentare + upgrade/reînnoire
   ├─ premium valid → PRE-001 Premium Command Center
   ├─ expirat/suspendat → Access: refuz explicat
   └─ necunoscut/eroare → fail-closed + Basic disponibil
```

## 3. Reguli obligatorii

1. Basic funcționează independent de disponibilitatea Premium.
2. Lipsa răspunsului API nu acordă acces Premium.
3. UI nu este sursa de adevăr pentru entitlement.
4. Fiecare rută Premium este verificată, nu doar pagina de intrare.
5. Un entitlement nu activează automat module AI dezactivate prin PRE-002.
6. Refuzul nu șterge datele și nu blochează revenirea la Basic.
7. Tier-ul comercial și capabilitățile tehnice sunt concepte separate.

## 4. Contract propus

```ts
type AccessEntitlementSnapshot = {
  subjectId: string;
  tier: 'basic' | 'premium';
  status: 'active' | 'expired' | 'suspended';
  capabilities: readonly string[];
  validUntil?: string;
  evaluatedAt: string;
  policyVersion: string;
};
```

Endpoint țintă: `GET /api/v1/auth/entitlements` protejat prin autentificarea API-002.

## 5. Stări UI

- `checking`: verificare în curs;
- `basic`: acces Basic, Premium neacordat;
- `premium`: entitlement valid;
- `expired`: necesită reînnoire;
- `suspended`: necesită suport administrativ;
- `unavailable`: verificarea nu poate fi făcută; Premium refuzat sigur.
