# APP-001 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate |
|---|---|---|
| View Module Registry | shell ↔ module | proprietar, view și lifecycle render/bind |
| App State Contract | shell ↔ stare | 11 slice-uri, proprietate unică a câmpurilor |
| Browser History | shell ↔ URL | pushState, popstate și hashchange |
| Premium Routes | shell ↔ Premium | registru separat pentru rute Premium |
| Turn fragments | URL → APP-011 | ancore interne fără schimbarea view-ului |
| Service Worker | bootstrap → runtime | înregistrare lifecycle existentă |
| i18n | shell ↔ UI | limbă profil și texte de stare |

