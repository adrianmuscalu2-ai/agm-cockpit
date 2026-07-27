# Livrabil 7 — Separarea Basic–Premium

## Frontiere

| Suprafață | Basic | Premium |
|---|---|---|
| Rute | registrul existent Basic | `premiumRouteRegistry` |
| UI | shell Basic | `PremiumShell` |
| Stare | stări existente | `TripContext` și nucleu Premium |
| Stocare | chei existente | namespace versionat `agm.premium.*` |
| API | contractele actuale | API Premium versionat/adaptor explicit |
| Build | funcționează independent | dezactivabil prin feature gate |

## Reguli

- Premium nu importă starea internă a ecranelor Basic.
- Partajarea se face numai prin porturi publice și DTO-uri versionate.
- Migrarea Premium nu atinge tabelele/cheile Basic fără decizie separată.
- Fișierele comune cer analiză de impact și regresie Basic.
- Nicio permisiune Android, variabilă de mediu, rută publică sau configurație de
  deployment nu se schimbă în Etapa 1.
- Publicarea Premium necesită propria poartă G7.

## Baseline-uri protejate

Premium Foundation, Premium Routes Registry, Premium Shell, Premium i18n,
Operational Team Foundation și versiunea publică Basic rămân baseline-uri de
regresie. Prezența actuală a unei componente Premium nu demonstrează conformitatea
ei cu noul contract.
