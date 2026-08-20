import { createPremiumAccessClient, PremiumAccessClientError } from './premium-access.client';
import { decidePremiumAccess } from './premium-access.guard';
import { clearVerifiedPremiumAccess, registerVerifiedPremiumAccess } from './premium-access.navigation';

const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '';
const development = env?.DEV === true ? '/api/v1' : '';
const apiBaseUrl = configured || development;
const REMEMBERED_EMAIL_KEY = 'agm.auth.rememberedEmail';

export function bindPremiumAccessRuntime() {
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
    passwordToggle.textContent = visible ? 'Arată parola' : 'Ascunde parola';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    setState(root, 'checking', 'Verificare în curs…');
    try {
      await client.login(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
      if (remember?.checked) window.sessionStorage.setItem(REMEMBERED_EMAIL_KEY, String(data.get('email') ?? '').trim());
      else window.sessionStorage.removeItem(REMEMBERED_EMAIL_KEY);
      form.reset();
      await refresh(root, client);
    } catch (error) {
      void client.logout();
      const accessError = error instanceof PremiumAccessClientError ? error : null;
      root.dataset.accessErrorReason = accessError?.reason ?? 'unexpected';
      root.dataset.accessErrorStatus = accessError?.status ? String(accessError.status) : '';
      setState(root, accessError?.reason === 'network' ? 'unavailable' : 'denied', loginFailureMessage(accessError));
    }
  });
  logout?.addEventListener('click', () => {
    void client.logout();
    clearVerifiedPremiumAccess();
    setState(root, 'basic', 'Sesiunea a fost închisă. AGM Basic rămâne disponibil.');
  });
  void refresh(root, client);
}

async function refresh(root: HTMLElement, client: ReturnType<typeof createPremiumAccessClient>) {
  if (!client.hasSession()) {
    const restored = await client.restore();
    if (!restored) {
      setState(root, 'basic', 'Autentificați-vă pentru verificarea accesului Premium.');
      return;
    }
  }
  setState(root, 'checking', 'Verificare entitlement…');
  try {
    const snapshot = await client.entitlements();
    const decision = decidePremiumAccess(snapshot, 'premium.command-center', new Date());
    if (decision.outcome === 'allow') registerVerifiedPremiumAccess(snapshot);
    else clearVerifiedPremiumAccess();
    setState(
      root,
      decision.outcome === 'allow' ? 'premium' : 'basic',
      decision.outcome === 'allow' ? 'Acces Premium valid.' : 'Cont Basic — accesul Premium nu este acordat.',
    );
  } catch (error) {
    clearVerifiedPremiumAccess();
    const unauthenticated = error instanceof PremiumAccessClientError &&
      (error.reason === 'unauthenticated' || error.status === 401);
    setState(
      root,
      unauthenticated ? 'basic' : 'unavailable',
      unauthenticated ? 'Autentificare necesară.' : 'Accesul nu poate fi verificat. Premium este refuzat sigur.',
    );
  }
}

function loginFailureMessage(error: PremiumAccessClientError | null) {
  if (!error) return 'Autentificarea nu a putut fi finalizată.';
  if (error.reason === 'network') return 'Serviciul de autentificare nu este disponibil. Verificați conexiunea.';
  if (error.status === 400) return 'Cererea de autentificare nu este validă. Verificați adresa de e-mail.';
  if (error.status === 401) return 'Datele de autentificare nu au fost acceptate.';
  if (error.status === 403) return 'Contul nu permite această autentificare.';
  if (error.status === 429) return 'Prea multe încercări. Așteptați un minut și încercați o singură dată.';
  if (error.status && error.status >= 500) return 'Serviciul de autentificare a întâmpinat o eroare internă.';
  if (error.reason === 'invalid-response') return 'Serviciul de autentificare a returnat un răspuns incomplet.';
  return 'Autentificarea nu a putut fi finalizată.';
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
