# APP-015 — Revizuire arhitecturală G2

**Verdict:** PASS INTERN  
**Mandat:** implementare strictă conform G1  

Designul elimină selecția implicită a platformei din boundary-ul consumator și introduce port/adaptoare fără a modifica funcția. Compatibilitatea APP-003 este protejată prin re-export. Nu sunt cerute permisiuni Android noi și nu se modifică Diagnostics, Audio sau Camera/OCR.

NO-GO: schimbare UI, schimbare payload, permisiune nouă, auto-send, package pinning sau regresie a facade-ului existent.

