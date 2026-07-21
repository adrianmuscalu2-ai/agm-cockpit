import {
  createPreDepartureSession,
  transitionPreDeparture,
} from './pre-departure.machine';
import { renderPreDepartureShell } from './pre-departure.shell';

export function mountPreDepartureShell(root: HTMLElement) {
  let session = createPreDepartureSession();

  const render = () => {
    root.innerHTML = renderPreDepartureShell(session);
    root
      .querySelector<HTMLButtonElement>('[data-before-departure-start]')
      ?.addEventListener('click', () => {
        session = transitionPreDeparture(session, { type: 'START_SESSION' }).session;
        render();
      });
  };

  render();
}
