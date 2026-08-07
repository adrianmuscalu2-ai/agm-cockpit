# AGM Basic — Sprint 4 Responsive mobil și UX Basic

Data: 2026-08-03  
Stare: `PASS / CLOSED`

## Obiectiv

Stabilizarea experienței mobile pentru Hub Basic și fluxurile închise în Sprinturile 1–3, fără funcții noi și fără schimbarea contractelor funcționale.

## Modificări

- blocarea scalării automate necontrolate a textului în WebView prin `text-size-adjust: 100%`, păstrând scalarea de accesibilitate configurată de utilizator;
- bară globală mobilă în trei coloane, cu safe-area și ținte tactile de minimum 48 px;
- rezultate contextuale cu titluri fluide, line-height stabil și liste compactate;
- pași de analiză adaptați pentru 520 px și 380 px;
- butoane OCR și acțiuni rezultat de minimum 50 px pe mobil;
- câmp OCR cu înălțime adaptivă și font minim 16 px;
- padding și densitate reduse prudent pe ecrane înguste.

## Fișiere

- `apps/web/src/styles/00-foundation.css`
- `apps/web/src/styles/20-domain-tools.css`
- `apps/web/scripts/test-basic-responsive-ux.ts`
- `evidence/agm-basic-sprint4-android-hub-pass.png`
- `evidence/agm-basic-sprint4-android-result-pass.png`

## Validare tehnică

- contract responsive Sprint 4: `PASS`;
- regresie Sprint 1: `PASS`;
- regresie Sprint 2: `PASS`;
- regresie Sprint 3: `PASS`;
- TypeScript și build web: `PASS` — 217 module transformate;
- build Android: `PASS`.

## Demonstrație Android

Dispozitiv: Samsung `SM-S931B`, aplicație `com.agm.cockpit`, versiune `1.3.0`.

Au fost verificate:

- Hub Basic cu scalarea mare de accesibilitate activă;
- lipsa overflow-ului orizontal;
- carduri lizibile și acțiuni accesibile;
- fluxul Mesaj textual din bord;
- rezultat contextual, cod, explicație și acțiuni;
- conținutul inferior și butoanele fără suprapunere distructivă.

Rezultat: `ANDROID RESPONSIVE DEMO — PASS`.

## Demonstrație Browser responsive

Validarea a fost executată manual pe originea curată `http://127.0.0.1:5174`, într-o fereastră îngustă.

Au fost confirmate:

- Hub Basic într-o singură coloană;
- toate cele trei fluxuri funcționale vizibile;
- carduri, descrieri și butoane lizibile;
- lipsa overflow-ului orizontal;
- rezultatul Mesaj textual din bord;
- statutul, categoria, codul `EBS-42`, instrucțiunea `Service` și explicația lizibile;
- navigarea verticală funcțională fără suprapuneri distructive.

Rezultat: `BROWSER RESPONSIVE DEMO — PASS`.

## Verdict final

`SPRINT 4 — RESPONSIVE MOBIL ȘI UX BASIC — PASS / CLOSED`

Toate cele patru sprinturi AGM Basic sunt închise. Orice etapă următoare necesită o decizie distinctă de roadmap; Production Readiness și Dashboard Warning Analysis rămân în backlog/on hold conform mandatului Ownerului.
