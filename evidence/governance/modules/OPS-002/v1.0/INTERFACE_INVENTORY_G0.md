# OPS-002 — Inventar interfețe G0

| Interfață | Direcție | Contract |
|---|---|---|
| Web bundle | APP runtime → Capacitor assets | `webDir: dist` |
| Platform services | APP-015 → Capacitor bridge | adaptoare browser/Android |
| Email/share | APP-003 → AgmEmailPlugin | intent explicit inițiat de utilizator |
| Diagnostics | Admin UI → AgmDiagnosticsPlugin | payload v1 fără secrete |
| Audio | Translator/UI → AgmAudioPlugin | permisiune runtime controlată |
| Camera/OCR | APP-004 → Android camera | permisiune minimă |
| API | WebView → API production | HTTPS; cleartext release interzis |
| Build/release | OPS-002 → OPS-004 | APK/AAB verificat, semnare externă modulului |
