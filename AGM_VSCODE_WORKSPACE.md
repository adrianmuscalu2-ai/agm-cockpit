# AGM VS Code Workspace

Acesta este mediul comun de dezvoltare pentru proiectul AGM. Configurația standardizează editorul, terminalele, extensiile recomandate și comenzile uzuale fără să modifice funcționalitatea aplicației.

## Deschidere

1. Deschide `AGM.code-workspace` în VS Code.
2. Acceptă instalarea extensiilor recomandate.
3. Rulează taskul `AGM: Install dependencies` numai când dependențele trebuie instalate sau actualizate.
4. Verifică taskul `AGM: Git status` înainte de lucru.

## Taskuri comune

Taskurile se găsesc în `Terminal > Run Task`:

- `AGM: Start development` pornește în paralel aplicația web și API-ul.
- `AGM: Web dev` pornește doar interfața locală.
- `AGM: API dev` pornește doar API-ul local.
- `AGM: Build web` validează tipurile și produce build-ul web.
- `AGM: Build API` compilează backend-ul.
- `AGM: Test API` rulează testele backend o singură dată.
- `AGM: Test Premium foundation` rulează verificările fundației Premium.
- `AGM: Android sync` sincronizează build-ul web cu proiectul Android.
- `AGM: Android debug APK` produce APK-ul de test.
- `AGM: Git status` afișează ramura și modificările locale.

## Reguli operaționale

- Se utilizează `pnpm`, conform versiunii declarate de proiect.
- Se păstrează modificările locale existente; nu se folosesc comenzi Git distructive.
- Se separă clar build-ul reușit de validarea Browser, Android și teren.
- Fișierele `.env` și secretele nu se adaugă în Git.
- Commitul se efectuează numai după validarea cerută pentru etapa curentă.

## Cerințe locale

- Node.js și pnpm.
- Git.
- Docker Desktop pentru operațiunile locale care folosesc containere.
- Android Studio/JDK pentru build-urile Android.

Pe Windows, taskurile folosesc executabilele `pnpm.cmd` și `git.exe`, evitând restricțiile PowerShell pentru scripturile `.ps1`.
