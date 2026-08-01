# APP-007 — Inventar interfețe

| Interfață | Direcție | Contract |
|---|---|---|
| Browser localStorage | APP-007 ↔ local | `agm.profile.settings`, `agm.profile.preferredLanguage` |
| Application shell | APP-007 → shell | nume afișat și limba preferată |
| APP-003 Email Assistant | APP-007 → APP-003 | identitate, contact și semnătură opționale |
| Canvas browser | UI → APP-007 | PNG local `data:image/png;base64,...` |

Nu există comunicare directă cu API, PostgreSQL, Cloudflare sau servicii Production.

