# AGM Basic — validare practică CMR

Data: 2026-08-04  
Platformă: Samsung SM-S931B / Android WebView  
Verdict final scenariu: **PASS după remediere punctuală**

## Imagine utilizată

- Fișier: `CMR_yuk_xati.jpg`
- Sursă: https://commons.wikimedia.org/wiki/File:CMR_yuk_xati.jpg
- Autor: Solijon Solayev
- Licență: CC BY-SA 4.0
- Tip: fotografie reală a unui formular CMR necompletat

## Text OCR confirmat

OCR Android a raportat încredere 72%. Textul confirmat a inclus, între altele:

```text
Xalqaro
tovar va transport CMR)
yuk xati
Bu transport, qaramay
boshqa har qanday shartnomalar uchun
Shartnoma lo'g'risidagi konventsiya shartlari bilan
xalqaro avtomobil transporti
yuk (CMR)
Qabul qiluvehi (smi, manzii, mamiakati)
Tashuvchi (nomi, manzili, mamlakati)
Qo'shilgan hujjatlar
Beigefiigte Dokumente
Belgilar va raqamiar
i 10 SEE
```

Textul a fost confirmat fără completarea unor date inexistente pe formular.

## Rezultat contextual final

- Stare: `Parțial`
- Fapt identificat: `Tip document — Scrisoare de trăsură CMR`
- Nu au fost declarate număr de document, dată, expeditor, destinatar, transportator sau vehicul.

## Explicație

Documentul este recunoscut ca formular CMR, dar este necompletat. Datele esențiale trebuie verificate înainte ca documentul să fie utilizat operațional.

## Acțiune recomandată

1. Compară datele identificate cu documentul original.
2. Completează sau verifică numărul documentului, data, expeditorul și destinatarul.
3. Nu confirma preluarea sau livrarea dacă datele esențiale nu corespund.

## Limitări declarate

- Sunt utilizate numai informațiile din OCR-ul confirmat.
- AGM nu certifică autenticitatea, semnătura sau valabilitatea juridică.
- Identificarea parțială obligă verificarea documentului original.

## Diferență și remediere

Prima analiză a interpretat greșit zgomotul OCR `malar` ca număr de document și `i 10 SEE` ca înmatriculare. Au fost întărite delimitările etichetelor și formatul înmatriculării. A fost adăugat un test de regresie pentru exact aceste fragmente.

Retestarea Android nu mai produce câmpurile false și clasifică formularul gol drept `Parțial`.

## Dovezi

- `CMR_yuk_xati.jpg` — imaginea publică testată
- `agm-cmr-pass.png` — rezultatul corectat afișat pe Android
- `apps/web/scripts/test-basic-transport-document-flow.ts` — regresia automată

**CMR PRACTICAL VALIDATION — PASS**
