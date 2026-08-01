# APP-007 — Evaluare de continuitate

## Baseline protejat

- formularul existent pentru nume, telefon, e-mail, companie și semnătură;
- limba preferată RO/DE/EN și compatibilitatea cu cheia legacy;
- salvarea locală în `agm.profile.settings`;
- semnătura desenată generată de canvas;
- consumul profilului de către Email Assistant și shell-ul aplicației.

## Evoluție incrementală

Datele text sunt normalizate la frontieră. Semnătura desenată acceptă exclusiv un PNG local în format data URL și este limitată la 1.000.000 de caractere. Valorile corupte, externe sau supradimensionate sunt abandonate sigur.

Nu au fost introduse dependențe, servicii ori mutații Production.

