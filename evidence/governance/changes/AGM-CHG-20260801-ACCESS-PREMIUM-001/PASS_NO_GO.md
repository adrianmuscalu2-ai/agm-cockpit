# Criterii PASS și NO-GO

## PASS

- Access și Premium au responsabilități și interfețe distincte;
- API-002 este unica autoritate pentru entitlement;
- accesul direct la orice rută Premium este verificat;
- eroarea sau absența entitlement-ului produce refuz fail-closed;
- Basic rămâne disponibil și fără regresii;
- entitlement-ul nu ocolește PRE-002 AI Governance;
- testele API, Web, Browser și Android sunt PASS;
- documentația, monitorizarea și procedura de incident sunt complete.

## HOLD

- schema comercială, politica de tier sau capability nu este aprobată;
- endpoint-ul și UI folosesc definiții incompatibile;
- lipsesc scenariile Android sau acces direct prin URL.

## NO-GO

- entitlement decis exclusiv în browser/local storage;
- acces permis la eroare de rețea sau răspuns invalid;
- activare implicită a AI ori a modulelor Premium;
- introducerea plăților, migrărilor DB, secretelor sau Production în acest dosar;
- afectarea funcțiilor Basic validate.
