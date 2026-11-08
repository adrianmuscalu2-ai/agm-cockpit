import type { BasicLanguageCode } from '../language-registry';

const copy = {
  ro: { open:'Am uitat parola', title:'Recuperare parolă AGM', email:'E-mailul contului AGM', send:'Trimite linkul de recuperare', sent:'Dacă există un cont activ pentru această adresă, veți primi un link valabil 15 minute. Verificați și Spam. PIN-ul TURN rămâne neschimbat.', password:'Parolă nouă (minimum 8 caractere)', repeat:'Repetați parola nouă', save:'Salvează parola nouă', mismatch:'Parolele nu coincid.', changed:'Parola a fost schimbată. Autentificați-vă cu noua parolă. PIN-ul TURN rămâne neschimbat.', failed:'Recuperarea nu a putut fi finalizată. Verificați conexiunea sau solicitați un link nou.', expired:'Linkul este invalid, expirat sau deja folosit. Solicitați un link nou.', back:'Înapoi la autentificare', waiting:'Se verifică…', length:'Parola trebuie să aibă minimum 8 caractere și maximum 72 de octeți.' },
  de: { open:'Passwort vergessen',title:'AGM-Passwort wiederherstellen',email:'E-Mail des AGM-Kontos',send:'Wiederherstellungslink senden',sent:'Falls ein aktives Konto existiert, erhalten Sie einen 15 Minuten gültigen Link. Prüfen Sie auch Spam. Die TURN-PIN bleibt unverändert.',password:'Neues Passwort (mindestens 8 Zeichen)',repeat:'Neues Passwort wiederholen',save:'Neues Passwort speichern',mismatch:'Die Passwörter stimmen nicht überein.',changed:'Passwort geändert. Melden Sie sich mit dem neuen Passwort an. Die TURN-PIN bleibt unverändert.',failed:'Wiederherstellung nicht möglich. Prüfen Sie die Verbindung oder fordern Sie einen neuen Link an.',expired:'Link ungültig, abgelaufen oder bereits verwendet. Fordern Sie einen neuen Link an.',back:'Zurück zur Anmeldung',waiting:'Wird geprüft…',length:'Mindestens 8 Zeichen und höchstens 72 Bytes sind erforderlich.' },
  en: { open:'Forgot password',title:'Recover AGM password',email:'AGM account email',send:'Send recovery link',sent:'If an active account exists, you will receive a link valid for 15 minutes. Check Spam too. Your TURN PIN stays unchanged.',password:'New password (at least 8 characters)',repeat:'Repeat new password',save:'Save new password',mismatch:'Passwords do not match.',changed:'Password changed. Sign in with your new password. Your TURN PIN stays unchanged.',failed:'Recovery could not be completed. Check your connection or request a new link.',expired:'Link invalid, expired, or already used. Request a new link.',back:'Back to sign in',waiting:'Checking…',length:'Use at least 8 characters and no more than 72 bytes.' },
  it: { open:'Password dimenticata',title:'Recupera password AGM',email:'E-mail account AGM',send:'Invia link di recupero',sent:'Se esiste un account attivo, riceverai un link valido 15 minuti. Controlla anche Spam. Il PIN TURN non cambia.',password:'Nuova password (almeno 8 caratteri)',repeat:'Ripeti nuova password',save:'Salva nuova password',mismatch:'Le password non coincidono.',changed:'Password modificata. Accedi con la nuova password. Il PIN TURN non cambia.',failed:'Recupero non completato. Verifica la connessione o richiedi un nuovo link.',expired:'Link non valido, scaduto o già utilizzato. Richiedi un nuovo link.',back:'Torna ad accedere',waiting:'Verifica…',length:'Usa almeno 8 caratteri e non più di 72 byte.' },
  es: { open:'Olvidé la contraseña',title:'Recuperar contraseña AGM',email:'Correo de la cuenta AGM',send:'Enviar enlace de recuperación',sent:'Si existe una cuenta activa, recibirás un enlace válido durante 15 minutos. Revisa Spam. El PIN TURN no cambia.',password:'Nueva contraseña (mínimo 8 caracteres)',repeat:'Repetir nueva contraseña',save:'Guardar nueva contraseña',mismatch:'Las contraseñas no coinciden.',changed:'Contraseña cambiada. Inicia sesión con la nueva contraseña. El PIN TURN no cambia.',failed:'No se pudo completar la recuperación. Revisa la conexión o solicita otro enlace.',expired:'Enlace inválido, caducado o usado. Solicita otro enlace.',back:'Volver al inicio de sesión',waiting:'Verificando…',length:'Usa al menos 8 caracteres y un máximo de 72 bytes.' },
  sv: { open:'Glömt lösenord',title:'Återställ AGM-lösenord',email:'AGM-kontots e-post',send:'Skicka återställningslänk',sent:'Om ett aktivt konto finns får du en länk som gäller i 15 minuter. Kontrollera skräppost. TURN-PIN-koden ändras inte.',password:'Nytt lösenord (minst 8 tecken)',repeat:'Upprepa nytt lösenord',save:'Spara nytt lösenord',mismatch:'Lösenorden matchar inte.',changed:'Lösenordet har ändrats. Logga in med det nya lösenordet. TURN-PIN-koden ändras inte.',failed:'Återställningen kunde inte slutföras. Kontrollera anslutningen eller begär en ny länk.',expired:'Länken är ogiltig, utgången eller använd. Begär en ny länk.',back:'Tillbaka till inloggning',waiting:'Kontrollerar…',length:'Använd minst 8 tecken och högst 72 byte.' },
} as const;

function text(language: BasicLanguageCode) { return language in copy ? copy[language as keyof typeof copy] : copy.en; }

// Survive a legal-consent/language re-render without writing the bearer link
// to browser storage or retaining it in the URL.
let recoveryToken = '';

export function renderPasswordRecovery(language: BasicLanguageCode, escape: (value: string) => string) {
  const t = text(language);
  return `<section data-password-recovery>
    <button type="button" class="premium-back" data-recovery-open>${escape(t.open)}</button>
    <section class="premium-module" data-recovery-panel hidden><div class="premium-module-content">
      <h2>${escape(t.title)}</h2>
      <form data-recovery-request>
        <label>${escape(t.email)}<input name="email" type="email" autocomplete="username" maxlength="254" required /></label>
        <button type="submit" class="premium-module-action">${escape(t.send)}</button>
      </form>
      <form data-recovery-confirm hidden>
        <label>${escape(t.password)}<input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required /></label>
        <label>${escape(t.repeat)}<input name="repeat" type="password" minlength="8" maxlength="72" autocomplete="new-password" required /></label>
        <button type="submit" class="premium-module-action">${escape(t.save)}</button>
      </form>
      <p data-recovery-status role="status" aria-live="polite"></p>
      <button type="button" class="premium-back" data-recovery-back>${escape(t.back)}</button>
    </div></section>
  </section>`;
}

export function bindPasswordRecovery(apiBaseUrl: string, language: BasicLanguageCode) {
  const root = document.querySelector<HTMLElement>('[data-password-recovery]');
  if (!root) return;
  const t = text(language);
  const panel = root.querySelector<HTMLElement>('[data-recovery-panel]')!;
  const request = root.querySelector<HTMLFormElement>('[data-recovery-request]')!;
  const confirm = root.querySelector<HTMLFormElement>('[data-recovery-confirm]')!;
  const login = document.querySelector<HTMLFormElement>('[data-access-login]');
  const status = root.querySelector<HTMLElement>('[data-recovery-status]')!;
  const open = root.querySelector<HTMLButtonElement>('[data-recovery-open]')!;
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('password-reset')) {
    recoveryToken = fragment.get('password-reset') ?? '';
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  }
  const show = () => { panel.hidden = false; open.hidden = true; if (login) login.hidden = true; panel.scrollIntoView({ block:'center' }); };
  open.addEventListener('click', () => { show(); request.hidden = false; confirm.hidden = true; status.textContent = ''; });
  root.querySelector('[data-recovery-back]')!.addEventListener('click', () => {
    recoveryToken = ''; confirm.reset(); panel.hidden = true; open.hidden = false; if (login) login.hidden = false;
  });
  if (recoveryToken) { show(); request.hidden = true; confirm.hidden = false; }
  else if (new URL(location.href).searchParams.get('recover') === '1') show();
  let busy = false;
  async function submit(form: HTMLFormElement, operation: string, body: Record<string,string>) {
    if (busy) return false;
    busy = true;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true; status.textContent = t.waiting;
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/password-recovery/${operation}`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(body), signal:AbortSignal.timeout(15000),
      });
      if (!response.ok) { status.textContent = operation === 'confirm' && response.status === 400 ? t.expired : t.failed; return false; }
      status.textContent = operation === 'request' ? t.sent : t.changed;
      return true;
    } catch { status.textContent = t.failed; return false; }
    finally { busy = false; button.disabled = false; }
  }
  request.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(request);
    await submit(request, 'request', { email:String(data.get('email') ?? '').trim() });
  });
  confirm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(confirm);
    const password = String(data.get('password') ?? '');
    if (password !== String(data.get('repeat') ?? '')) { status.textContent = t.mismatch; return; }
    if (Array.from(password).length < 8 || new TextEncoder().encode(password).length > 72) { status.textContent = t.length; return; }
    if (await submit(confirm, 'confirm', { token: recoveryToken, password })) {
      recoveryToken = ''; confirm.reset(); confirm.hidden = true;
      sessionStorage.removeItem('agm.auth.accessToken');
      if (login) { login.reset(); login.hidden = false; }
    }
  });
}
