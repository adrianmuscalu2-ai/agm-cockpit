import { createPremiumAccessClient, PremiumAccessClientError } from './premium-access.client';
import { decidePremiumAccess } from './premium-access.guard';
import { clearVerifiedPremiumAccess, registerVerifiedPremiumAccess } from './premium-access.navigation';

const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '';
const development = env?.DEV === true ? '/api/v1' : '';
const apiBaseUrl = configured || development;

export function bindPremiumAccessRuntime() {
  const root = document.querySelector<HTMLElement>('[data-access-enforcement]');
  if (!root || !apiBaseUrl) return;
  const client = createPremiumAccessClient({ apiBaseUrl, fetch: window.fetch.bind(window), sessionStorage: window.sessionStorage });
  const form = root.querySelector<HTMLFormElement>('[data-access-login]');
  const logout = root.querySelector<HTMLButtonElement>('[data-access-logout]');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    setState(root, 'checking', 'Verificare în curs…');
    try {
      await client.login(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
      form.reset();
      await refresh(root, client);
    } catch {
      client.logout();
      setState(root, 'denied', 'Autentificarea nu a reușit. Verificați datele și conexiunea.');
    }
  });
  logout?.addEventListener('click', () => {
    client.logout();
    clearVerifiedPremiumAccess();
    setState(root, 'basic', 'Sesiunea a fost închisă. AGM Basic rămâne disponibil.');
  });
  void refresh(root, client);
}

async function refresh(root: HTMLElement, client: ReturnType<typeof createPremiumAccessClient>) {
  if (!client.hasSession()) {
    setState(root, 'basic', 'Autentificați-vă pentru verificarea accesului Premium.');
    return;
  }
  setState(root, 'checking', 'Verificare entitlement…');
  try {
    const snapshot = await client.entitlements();
    const decision = decidePremiumAccess(snapshot, 'premium.command-center', new Date());
    if (decision.outcome === 'allow') registerVerifiedPremiumAccess(snapshot);
    else clearVerifiedPremiumAccess();
    setState(root, decision.outcome === 'allow' ? 'premium' : 'basic',
      decision.outcome === 'allow' ? 'Acces Premium valid.' : 'Cont Basic — accesul Premium nu este acordat.');
  } catch (error) {
    clearVerifiedPremiumAccess();
    const unauthenticated = error instanceof PremiumAccessClientError && error.reason === 'unauthenticated';
    setState(root, 'unavailable', unauthenticated ? 'Autentificare necesară.' : 'Accesul nu poate fi verificat. Premium este refuzat sigur.');
  }
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
