# Rescue OCR desktop — 2026-09-12

- Defect raportat: Android PASS; PC și laptop FAIL la fotografiere OCR.
- Domeniu înghețat: Android și OCR global 27/27 pagini rămân PASS.
- Cauză: atributul HTML capture deschide camera pe Android, dar pe browser desktop deschide doar selectorul de fișiere.
- Clasificare: defect de produs, flux desktop incomplet.
- Recuperare: previzualizare webcam prin getUserMedia, captură JPEG și fallback automat la alegerea imaginii când camera lipsește.
- Încercarea 1: runnerul nu a pornit deoarece căuta Vite în rădăcina monorepo; fără test de produs executat.
- Încercarea 2: ruta Vite corectată la apps/web/node_modules; test minim desktop PASS.
- Dovadă: raportul 2026-09-12T09-23-21-732Z confirmă OCR real din fișier, stream webcam 1920x1080 și procesarea capturii.
- Dependențe instalate: niciuna.
