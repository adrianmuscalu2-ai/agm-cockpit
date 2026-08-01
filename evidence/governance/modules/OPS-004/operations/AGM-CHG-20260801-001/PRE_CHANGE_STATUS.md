# AGM-CHG-20260801-001 — Stare pre-change

**Captură UTC:** 2026-08-01T06:25:27Z  
**Gate:** REMEDIATION PASS / RETURNED TO PRE-CHANGE / MUTATION HOLD

## PASS read-only

- mandat operațional primit;
- contractul OPS-004 v1.0 este PASS/CLOSED;
- `https://api.agmcockpit.com/api/v1/health/live`: HTTP 200, status `ok`;
- `https://api.agmcockpit.com/api/v1/health/ready`: HTTP 200, status `ready`;
- `https://app.agmcockpit.com`: HTTP 200;
- `agm-postgres`: healthy;
- `agm-development-postgres`: healthy;
- hashurile configurației și runbookurilor pot fi capturate local;
- nu au fost accesate secrete și nu a fost executată nicio mutație.

## Completări după mandatul de continuare

- fereastra, ținta și artefactul candidat au fost consemnate;
- cele patru roluri și executorul au fost nominalizate în sesiuni distincte;
- canalul STOP a fost definit;
- Hetzner a fost confirmat drept single writer, iar PC fallback este read-only;
- artefactul activ coincide cu digestul și revizia aprobate;
- API, PostgreSQL, conectorul și backup timer Hetzner sunt active;
- migrațiile sunt 5 complete / 0 incomplete.

## Observații

- serviciul Windows `Cloudflared` este `Stopped`, cu StartType `Automatic`, conform stării standby după cutover;
- containerul fallback `agm-postgres` expune în starea curentă portul 5432 pe host; această stare trebuie clasificată înainte de o schimbare care îl implică;
- aceste constatări nu justifică pornirea, oprirea sau reconfigurarea automată.

## Decizie

Abaterea unității tranzitorii a fost remediată sub mandat separat. Unitatea persistentă a pornit automat după reboot, iar serviciile, datele, single-writer și ruta publică sunt intacte. Independent Validator a autorizat revenirea directă la PRE-CHANGE, iar Fallback Responsible a emis PASS.

Rollback Responsible menține HOLD pentru prima mutație până la actualizarea elementelor strict dependente de fereastră: interval UTC curent, checklist adaptat topologiei post-cutover și secvență exactă de rollback. Etapele tehnice deja PASS nu se repetă.
