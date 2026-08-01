# APP-001 — Contract de navigare v1

- Contract: `app-shell-navigation.v1`;
- fallback pentru rută necunoscută: `home`;
- evenimente lifecycle: initial-render, navigate, popstate, hashchange;
- fiecare view shell are o singură rută canonică;
- aliasurile istorice RO/EN și codurile AG rămân suportate;
- rutele canonice sunt reversibile view → route → view;
- fragmentele `turn-*` și `incident-journal` nu schimbă view-ul Turn;
- rutele Premium rămân în registrul Premium dedicat;
- toate view-urile rutabile trebuie să existe în View Module Registry.

## NO-GO

- două view-uri cu aceeași rută canonică;
- alias fără view înregistrat;
- navigare care pierde view-ul la popstate/hashchange;
- rută necunoscută care produce ecran invalid;
- modificarea Production fără mandat separat.

