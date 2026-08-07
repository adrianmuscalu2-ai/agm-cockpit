# APP-004 — Runbook monitorizare și mentenanță arhivă OCR locală

**Domeniu:** arhiva OCR locală din Browser și Android. Monitorizarea este read-only și nu citește conținutul arhivei.

## Responsabilități

- **Monitor:** MON-004/MON-005/MON-009, cu escaladare de confidențialitate la MON-012. Observă numai disponibilitate, rezultat (`healthy`/`degraded`/`failed`), durată, număr agregat și erori tehnice clasificate.
- **Mentenanță:** OCR/Web maintainer și `agent-codex`, numai sub mandatul Module Ownerului. Păstrează compatibilitatea schemei, retenția, ștergerea și funcționarea offline.
- **Documentație:** Documentation Owner redactează contractul, instrucțiunile și schimbările. AGM Chronicler și Version Guardian arhivează dovezile tehnice, niciodată documentele utilizatorului.
- **Validare:** QA OCR și Architecture Guardian rămân independenți de implementator.

## Date permise și interzise

Sunt permise numai valori tehnice agregate: versiune aplicație/schemă, platformă, stare operație, durată rotunjită, număr de elemente și cod de eroare controlat.

Sunt interzise în monitorizare, loguri, incidente, capturi și telemetrie: text OCR extras sau tradus, imagini/data URL/base64/blob, titluri ori nume de fișier, identificatori de document, fragmente de conținut și valoarea brută din `agm.ocr.history.v1`. Mesajele de eroare externe se mapează la coduri controlate; nu se copiază brut.

## Monitorizare

1. La fiecare schimbare relevantă și înainte de release, se rulează `pnpm exec tsx scripts/test-app004-ocr-monitoring-privacy.ts` din `apps/web`.
2. Smoke test Browser și Android: creare locală, redeschidere offline, ștergere individuală/totală și confirmarea absenței traficului cu imagine/text.
3. Stare sănătoasă: validator PASS, operații locale reușite, nicio cerere de rețea cu date OCR și nicio eroare de schemă.
4. Prag de incident: orice conținut privat observat în monitorizare este incident critic și produce HOLD imediat. Orice eșec de citire/scriere/ștergere repetat de două ori este `degraded` și se înregistrează fără payload privat.
5. Escaladare: Monitor → Incident Journal → Module Owner + MON-012 → containment. Monitorul nu remediază și nu inspectează conținutul privat.

## Mentenanță și recuperare

1. Reproduceți cu date sintetice, fără copia documentelor reale.
2. Pentru corupție sau incompatibilitate, opriți scrierea și păstrați datele existente; nu faceți migrare distructivă. Oferiți ștergere/export controlat dacă formatul rămâne lizibil.
3. Pentru quota/storage indisponibil, păstrați OCR utilizabil în sesiune, informați utilizatorul că arhivarea a eșuat și nu activați fallback cloud.
4. După remediere: teste contractuale, privacy validator, Browser/Android, QA, Inspector, documentare și arhivarea checksumurilor.
5. Rollback: revenire la ultima schemă compatibilă fără a rescrie istoricul. Dacă rollback-ul nu poate garanta integritatea ori ștergerea, funcția de arhivare rămâne dezactivată.

## PASS / NO-GO

**PASS:** validatorul și regresiile sunt verzi; fluxul rămâne local/offline; retenția și ștergerea funcționează; monitorizarea conține exclusiv date tehnice agregate; runbook-ul și escaladarea sunt verificabile.

**NO-GO:** text/imagine/titlu/identificator privat în monitorizare sau log; upload ori fallback cloud; salvare fără alegerea utilizatorului; ștergere incompletă; migrare distructivă; monitor care execută remedierea; afirmație de criptare fără dovadă.
