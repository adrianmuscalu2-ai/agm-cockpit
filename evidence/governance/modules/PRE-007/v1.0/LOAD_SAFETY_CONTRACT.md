# PRE-007 — Contract Load Safety v1.0

1. Sunt acceptate numai JPEG, PNG și WEBP, maximum 8 MB per imagine.
2. Imaginile sunt selectate explicit și nu sunt stocate implicit.
3. Field Test necesită două perspective laterale utilizabile: față-oblic și spate-oblic.
4. Calitatea tehnică verifică rezoluția, claritatea și expunerea înainte de analiză.
5. Partea opusă nevizibilă este declarată informație lipsă; simetria cere declarația șoferului.
6. Valorile OCR LC/STF nu sunt trimise drept confirmate fără acord uman explicit.
7. Fiecare concluzie are certitudine, surse și explicație.
8. Rezultatele sunt orientative și nu constituie certificare sau decizie legală.
9. Erorile API sunt clasificate fără divulgarea secretelor/provider payload.
10. PRE-007 nu schimbă automat TripContext și nu execută acțiuni externe.

**Criteriu PASS:** contract Web–API coerent, validări imagini, surse/certitudine, confirmare umană și regresii zero.

**HOLD/NO-GO:** format/mărime invalidă, perspective obligatorii lipsă, OCR neconfirmat tratat ca fapt, disclaimer absent, stocare implicită sau mutație Production.

