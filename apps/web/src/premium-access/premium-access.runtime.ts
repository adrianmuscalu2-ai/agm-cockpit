import { createPremiumAccessClient, PremiumAccessClientError } from './premium-access.client';
import { decidePremiumAccess } from './premium-access.guard';
import { clearVerifiedPremiumAccess, registerVerifiedPremiumAccess } from './premium-access.navigation';
import type { BasicLanguageCode } from '../language-registry';

const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '';
const development = env?.DEV === true ? '/api/v1' : '';
const apiBaseUrl = configured || development;
const REMEMBERED_EMAIL_KEY = 'agm.auth.rememberedEmail';

const runtimeCopy = {
  ro: { show:'Arată parola', hide:'Ascunde parola', checking:'Verificare în curs…', closed:'Sesiunea a fost închisă. AGM Basic rămâne disponibil.', signIn:'Autentificați-vă pentru verificarea accesului Premium.', entitlement:'Verificare entitlement…', valid:'Acces Premium valid.', basic:'Cont Basic — accesul Premium nu este acordat.', auth:'Autentificare necesară.', unavailable:'Accesul nu poate fi verificat. Premium este refuzat sigur.', generic:'Autentificarea nu a putut fi finalizată.', network:'Serviciul de autentificare nu este disponibil. Verificați conexiunea.', invalid:'Cererea de autentificare nu este validă. Verificați adresa de e-mail.', rejected:'Datele de autentificare nu au fost acceptate.', forbidden:'Contul nu permite această autentificare.', rate:'Prea multe încercări. Așteptați un minut și încercați o singură dată.', server:'Serviciul de autentificare a întâmpinat o eroare internă.', incomplete:'Serviciul de autentificare a returnat un răspuns incomplet.' },
  de: { show:'Passwort anzeigen', hide:'Passwort ausblenden', checking:'Überprüfung läuft…', closed:'Die Sitzung wurde beendet. AGM Basic bleibt verfügbar.', signIn:'Melden Sie sich an, um den Premium-Zugang zu prüfen.', entitlement:'Berechtigung wird geprüft…', valid:'Premium-Zugang gültig.', basic:'Basic-Konto — Premium-Zugang wurde nicht erteilt.', auth:'Anmeldung erforderlich.', unavailable:'Der Zugang kann nicht geprüft werden. Premium wird sicher verweigert.', generic:'Die Anmeldung konnte nicht abgeschlossen werden.', network:'Der Anmeldedienst ist nicht verfügbar. Prüfen Sie die Verbindung.', invalid:'Die Anmeldeanfrage ist ungültig. Prüfen Sie die E-Mail-Adresse.', rejected:'Die Anmeldedaten wurden nicht akzeptiert.', forbidden:'Dieses Konto erlaubt diese Anmeldung nicht.', rate:'Zu viele Versuche. Warten Sie eine Minute und versuchen Sie es einmal erneut.', server:'Beim Anmeldedienst ist ein interner Fehler aufgetreten.', incomplete:'Der Anmeldedienst hat eine unvollständige Antwort geliefert.' },
  en: { show:'Show password', hide:'Hide password', checking:'Verification in progress…', closed:'The session was closed. AGM Basic remains available.', signIn:'Sign in to verify Premium access.', entitlement:'Verifying entitlement…', valid:'Premium access valid.', basic:'Basic account — Premium access was not granted.', auth:'Authentication required.', unavailable:'Access cannot be verified. Premium is safely denied.', generic:'Sign-in could not be completed.', network:'The authentication service is unavailable. Check the connection.', invalid:'The authentication request is invalid. Check the email address.', rejected:'The sign-in details were not accepted.', forbidden:'This account does not permit this sign-in.', rate:'Too many attempts. Wait one minute and try once more.', server:'The authentication service encountered an internal error.', incomplete:'The authentication service returned an incomplete response.' },
  it: { show:'Mostra password', hide:'Nascondi password', checking:'Verifica in corso…', closed:'La sessione è stata chiusa. AGM Basic resta disponibile.', signIn:'Accedi per verificare l’accesso Premium.', entitlement:'Verifica del diritto di accesso…', valid:'Accesso Premium valido.', basic:'Account Basic — accesso Premium non concesso.', auth:'Autenticazione necessaria.', unavailable:'Impossibile verificare l’accesso. Premium viene negato in modo sicuro.', generic:'Impossibile completare l’accesso.', network:'Il servizio di autenticazione non è disponibile. Verifica la connessione.', invalid:'La richiesta di accesso non è valida. Verifica l’indirizzo e-mail.', rejected:'Le credenziali non sono state accettate.', forbidden:'Questo account non consente l’accesso.', rate:'Troppi tentativi. Attendi un minuto e riprova una sola volta.', server:'Il servizio di autenticazione ha riscontrato un errore interno.', incomplete:'Il servizio di autenticazione ha restituito una risposta incompleta.' },
  es: { show:'Mostrar contraseña', hide:'Ocultar contraseña', checking:'Verificación en curso…', closed:'La sesión se ha cerrado. AGM Basic sigue disponible.', signIn:'Inicia sesión para verificar el acceso Premium.', entitlement:'Verificando el derecho de acceso…', valid:'Acceso Premium válido.', basic:'Cuenta Basic — no se ha concedido acceso Premium.', auth:'Autenticación necesaria.', unavailable:'No se puede verificar el acceso. Premium se deniega de forma segura.', generic:'No se pudo completar el inicio de sesión.', network:'El servicio de autenticación no está disponible. Comprueba la conexión.', invalid:'La solicitud de inicio de sesión no es válida. Comprueba el correo electrónico.', rejected:'No se aceptaron las credenciales.', forbidden:'Esta cuenta no permite iniciar sesión.', rate:'Demasiados intentos. Espera un minuto e inténtalo una sola vez.', server:'El servicio de autenticación ha encontrado un error interno.', incomplete:'El servicio de autenticación devolvió una respuesta incompleta.' },
  sv: { show:'Visa lösenord', hide:'Dölj lösenord', checking:'Verifiering pågår…', closed:'Sessionen har avslutats. AGM Basic är fortfarande tillgängligt.', signIn:'Logga in för att verifiera Premium-åtkomst.', entitlement:'Behörigheten verifieras…', valid:'Premium-åtkomst giltig.', basic:'Basic-konto — Premium-åtkomst har inte beviljats.', auth:'Autentisering krävs.', unavailable:'Åtkomsten kan inte verifieras. Premium nekas på ett säkert sätt.', generic:'Inloggningen kunde inte slutföras.', network:'Autentiseringstjänsten är inte tillgänglig. Kontrollera anslutningen.', invalid:'Inloggningsbegäran är ogiltig. Kontrollera e-postadressen.', rejected:'Inloggningsuppgifterna accepterades inte.', forbidden:'Det här kontot tillåter inte inloggning.', rate:'För många försök. Vänta en minut och försök en gång till.', server:'Ett internt fel uppstod i autentiseringstjänsten.', incomplete:'Autentiseringstjänsten returnerade ett ofullständigt svar.' },
} as const;

type RuntimeCopy = (typeof runtimeCopy)[keyof typeof runtimeCopy];

export function bindPremiumAccessRuntime(language: BasicLanguageCode = 'ro') {
  const text: RuntimeCopy = language in runtimeCopy ? runtimeCopy[language as keyof typeof runtimeCopy] : runtimeCopy.en;
  const root = document.querySelector<HTMLElement>('[data-access-enforcement]');
  if (!root || !apiBaseUrl) return;
  const client = createPremiumAccessClient({ apiBaseUrl, fetch: window.fetch.bind(window), sessionStorage: window.sessionStorage });
  const form = root.querySelector<HTMLFormElement>('[data-access-login]');
  const logout = root.querySelector<HTMLButtonElement>('[data-access-logout]');
  const email = form?.elements.namedItem('email') as HTMLInputElement | null;
  const password = form?.elements.namedItem('password') as HTMLInputElement | null;
  const remember = root.querySelector<HTMLInputElement>('[data-access-remember]');
  const passwordToggle = root.querySelector<HTMLButtonElement>('[data-password-toggle]');
  const rememberedEmail = window.sessionStorage.getItem(REMEMBERED_EMAIL_KEY);
  if (email && rememberedEmail) email.value = rememberedEmail;
  if (remember) remember.checked = Boolean(rememberedEmail);
  passwordToggle?.addEventListener('click', () => {
    if (!password) return;
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', String(!visible));
    passwordToggle.textContent = visible ? text.show : text.hide;
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    setState(root, 'checking', text.checking);
    try {
      await client.login(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
      if (remember?.checked) window.sessionStorage.setItem(REMEMBERED_EMAIL_KEY, String(data.get('email') ?? '').trim());
      else window.sessionStorage.removeItem(REMEMBERED_EMAIL_KEY);
      form.reset();
      await refresh(root, client, text);
    } catch (error) {
      void client.logout();
      const accessError = error instanceof PremiumAccessClientError ? error : null;
      root.dataset.accessErrorReason = accessError?.reason ?? 'unexpected';
      root.dataset.accessErrorStatus = accessError?.status ? String(accessError.status) : '';
      setState(root, accessError?.reason === 'network' ? 'unavailable' : 'denied', loginFailureMessage(accessError, text));
    }
  });
  logout?.addEventListener('click', () => {
    void client.logout();
    clearVerifiedPremiumAccess();
    setState(root, 'basic', text.closed);
  });
  void refresh(root, client, text);
}

async function refresh(root: HTMLElement, client: ReturnType<typeof createPremiumAccessClient>, text: RuntimeCopy) {
  if (!client.hasSession()) {
    const restored = await client.restore();
    if (!restored) {
      setState(root, 'basic', text.signIn);
      return;
    }
  }
  setState(root, 'checking', text.entitlement);
  try {
    const snapshot = await client.entitlements();
    const decision = decidePremiumAccess(snapshot, 'premium.command-center', new Date());
    if (decision.outcome === 'allow') registerVerifiedPremiumAccess(snapshot);
    else clearVerifiedPremiumAccess();
    setState(
      root,
      decision.outcome === 'allow' ? 'premium' : 'basic',
      decision.outcome === 'allow' ? text.valid : text.basic,
    );
  } catch (error) {
    clearVerifiedPremiumAccess();
    const unauthenticated = error instanceof PremiumAccessClientError &&
      (error.reason === 'unauthenticated' || error.status === 401);
    setState(
      root,
      unauthenticated ? 'basic' : 'unavailable',
      unauthenticated ? text.auth : text.unavailable,
    );
  }
}

function loginFailureMessage(error: PremiumAccessClientError | null, text: RuntimeCopy) {
  if (!error) return text.generic;
  if (error.reason === 'network') return text.network;
  if (error.status === 400) return text.invalid;
  if (error.status === 401) return text.rejected;
  if (error.status === 403) return text.forbidden;
  if (error.status === 429) return text.rate;
  if (error.status && error.status >= 500) return text.server;
  if (error.reason === 'invalid-response') return text.incomplete;
  return text.generic;
}

function setState(root: HTMLElement, state: string, message: string) {
  root.dataset.accessState = state;
  const status = root.querySelector<HTMLElement>('[data-access-status]');
  if (status) status.textContent = message;
  const premiumLink = root.querySelector<HTMLAnchorElement>('[data-access-premium-link]');
  const allowed = state === 'premium';
  if (premiumLink) {
    premiumLink.hidden = !allowed;
    premiumLink.setAttribute('aria-disabled', String(!allowed));
  }
}
