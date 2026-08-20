import { USER_ACCESS_TOKEN_KEY } from '../premium-access/premium-access.client';
import { CommunicationClient, type CommunicationChannel } from './communication.client';

const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const apiBase = (typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '') || (env?.DEV === true ? '/api/v1' : '');

export function bindCommunicationRuntime() {
  const root = document.querySelector<HTMLElement>('[data-premium-communications]');
  if (!root || !apiBase) return;
  const status = root.querySelector<HTMLElement>('[data-communication-status]');
  const form = root.querySelector<HTMLFormElement>('[data-communication-compose]');
  const client = new CommunicationClient(apiBase, () => sessionStorage.getItem(USER_ACCESS_TOKEN_KEY), recordTimeline);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    setStatus(status, 'Trimitere în curs…');
    try {
      const message = await client.send({ channel: String(data.get('channel')) as CommunicationChannel, to: String(data.get('to') ?? ''), subject: String(data.get('subject') ?? '') || undefined, bodyText: String(data.get('bodyText') ?? ''), tripId: activeTripId() });
      setStatus(status, message.status === 'failed' ? 'Furnizor indisponibil sau neconfigurat. Mesajul este marcat FAILED.' : `Mesaj ${message.status}.`);
      if (message.status !== 'failed') form.reset();
      await refresh(root, client);
    } catch (error) { setStatus(status, humanError(error)); }
  });
  root.querySelector('[data-refresh-communications]')?.addEventListener('click', () => void refresh(root, client));
  root.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-retry-message]');
    if (!button?.dataset.retryMessage) return;
    button.disabled = true;
    try { await client.retry(button.dataset.retryMessage); await refresh(root, client); }
    catch (error) { setStatus(status, humanError(error)); }
    finally { button.disabled = false; }
  });
  void refresh(root, client);
}

async function refresh(root: HTMLElement, client: CommunicationClient) {
  const list = root.querySelector<HTMLOListElement>('[data-communication-list]');
  if (!list) return;
  try {
    const conversations = await client.conversations();
    list.replaceChildren(...(conversations.length ? conversations.map((conversation) => {
      const item = document.createElement('li');
      const last = conversation.messages.at(-1);
      const text = document.createElement('span');
      text.textContent = `${conversation.channel.toUpperCase()} · ${last?.direction ?? 'empty'} · ${last?.status ?? 'empty'} · ${last?.bodyText ?? ''}`;
      item.append(text);
      if (last?.direction === 'outbound' && last.status === 'failed') {
        const retry = document.createElement('button');
        retry.type = 'button'; retry.dataset.retryMessage = last.id; retry.textContent = 'Reîncearcă';
        item.append(retry);
      }
      return item;
    }) : [Object.assign(document.createElement('li'), { textContent: 'Nu există conversații.' })]));
  } catch (error) { list.replaceChildren(Object.assign(document.createElement('li'), { textContent: humanError(error) })); }
}

function activeTripId() { try { return JSON.parse(sessionStorage.getItem('agm.premium.trip-context.v1') ?? 'null')?.tripId as string | undefined; } catch { return undefined; } }
function recordTimeline(event: unknown) { const key='agm.premium.communication-timeline.v1';let values:unknown[]=[];try{values=JSON.parse(sessionStorage.getItem(key)??'[]');}catch{}sessionStorage.setItem(key,JSON.stringify([...values,event])); }
function setStatus(element: HTMLElement|null, value: string) { if (element) element.textContent=value; }
function humanError(error: unknown) { const value=error instanceof Error?error.message:'';if(value.includes('AUTH_REQUIRED')||value.includes(':401'))return 'Autentificare Premium necesară.';if(value.includes(':503')||value.includes('NOT_CONFIGURED'))return 'Canalul nu este încă configurat.';return 'Operația nu a reușit. Încercați din nou.'; }
