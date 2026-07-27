# Livrabil 5 — Regulile de recuperare și audit

## Verificări de integritate

- validarea schemei și a semnăturii/hashului;
- unicitatea `eventId` și `operationId`;
- continuitatea secvenței server per Trip;
- continuitatea secvenței locale per dispozitiv;
- verificarea `aggregateVersion`;
- existența evenimentelor cauzale;
- hashurile dovezilor și exporturilor;
- diferența controlată `occurredAt` / `recordedAt`.

## Lanțuri

Evenimentele offline folosesc `deviceSequence` și `previousDeviceEventHash`.
Serverul nu rescrie lanțul local; îl validează și alocă `tripSequence` plus
`previousTripEventHash`. Astfel, ramurile offline pot fi reconciliate fără
falsificarea cronologiei.

## Recuperare

1. aplicația intră în `RECOVERY_REQUIRED`;
2. îngheață operațiile ireversibile;
3. verifică snapshotul local și outbox-ul;
4. descarcă ultimul checkpoint server autorizat;
5. verifică evenimentele comune;
6. retrimite idempotent evenimentele lipsă;
7. conflictele critice cer rezoluție umană;
8. reconstruiește proiecțiile;
9. emite `recovery.completed` sau păstrează blocajul.

## Audit

Auditorul primește un pachet read-only cu:

- manifest, schemă și versiuni;
- timeline ordonat;
- confirmări și actori;
- lifecycle și flags;
- warnings/incidente și transferuri;
- dovezi/hashuri disponibile;
- sync/conflict/recovery;
- export log și verificarea integrității.

Accesul auditorului este autorizat, limitat ca scop și jurnalizat. Auditul nu
modifică arhiva.
