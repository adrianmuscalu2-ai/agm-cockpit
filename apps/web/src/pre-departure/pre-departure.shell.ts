import type { PreDepartureSession } from './pre-departure.types';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function renderPreDepartureShell(session: PreDepartureSession) {
  return `
    <main class="before-departure-shell" data-e6-entry="before-departure">
      <header class="before-departure-header">
        <a class="before-departure-back" href="/" aria-label="Înapoi la AGM">← AGM</a>
        <p class="before-departure-kicker">ETAPA 6 · E6.3 Browser shell</p>
        <h1>Înainte de Plecare</h1>
        <p class="before-departure-languages">Vor der Abfahrt · Before Departure</p>
      </header>

      <section class="before-departure-card" aria-labelledby="before-departure-status-title">
        <h2 id="before-departure-status-title">Evaluare locală controlată</h2>
        <p>
          Modulul folosește nucleul E6.2 și nu transmite date către companie,
          autorități sau alte servicii externe.
        </p>
        <dl class="before-departure-status">
          <div>
            <dt>Stare nucleu</dt>
            <dd data-before-departure-state>${escapeHtml(session.state)}</dd>
          </div>
          <div>
            <dt>Platformă curentă</dt>
            <dd>Browser</dd>
          </div>
        </dl>
        ${
          session.state === 'NOT_STARTED'
            ? '<button type="button" data-before-departure-start>Începe evaluarea</button>'
            : `<p class="before-departure-next" role="status">
                Nucleul este pregătit. Selectarea contextului și fluxul complet vor fi livrate în E6.4.
              </p>`
        }
      </section>

      <aside class="before-departure-limit" aria-label="Limită E6.3">
        E6.3 validează accesul și shell-ul Browser. Integrarea Android completă
        este planificată pentru E6.6.
      </aside>
    </main>
  `;
}
