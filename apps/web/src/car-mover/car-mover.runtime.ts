import type { BasicLanguageCode } from '../language-registry';
import { carMoverClient, type JobFile } from './car-mover.client';
import { carMoverText as x } from './car-mover.i18n';

const next: Record<string, string[]> = {
  DRAFT: ['READY', 'CANCELLED', 'BLOCKED', 'ESCALATED'],
  READY: ['ASSIGNED', 'CANCELLED', 'BLOCKED', 'ESCALATED'],
  ASSIGNED: ['ACCEPTED', 'CANCELLED', 'BLOCKED', 'ESCALATED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED', 'BLOCKED', 'ESCALATED'],
  IN_PROGRESS: ['ARRIVED', 'BLOCKED', 'ESCALATED'],
  ARRIVED: ['HANDOVER_PENDING', 'BLOCKED', 'ESCALATED'],
  HANDOVER_PENDING: ['COMPLETED', 'BLOCKED', 'ESCALATED'],
};

const protocolForState = (state: string) =>
  ['ACCEPTED', 'IN_PROGRESS'].includes(state) ? 'TAKEOVER' :
  ['ARRIVED', 'HANDOVER_PENDING'].includes(state) ? 'HANDOVER' : undefined;

export function bindCarMoverRuntime() {
  const root = document.querySelector<HTMLElement>('[data-car-mover-root]');
  if (!root) return;
  const language = root.dataset.language as BasicLanguageCode;
  const list = root.querySelector<HTMLElement>('[data-car-mover-list]')!;
  const status = root.querySelector<HTMLElement>('[data-car-mover-status]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-car-mover-dialog]')!;
  const fileRoot = root.querySelector<HTMLElement>('[data-car-mover-file]')!;
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!);
  const reportError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : x(language, 'error'); };

  async function load() {
    list.textContent = x(language, 'loading');
    try {
      const jobs = await carMoverClient.list();
      list.innerHTML = jobs.length ? jobs.map((job) => `<button class="car-mover-job" data-job="${job.id}"><strong>${esc(job.vehicleSubject.make)} ${esc(job.vehicleSubject.model || job.vehicleSubject.vehicleType)}</strong><span>${esc(job.pickupSnapshot.label)} → ${esc(job.destinationSnapshot.label)}</span><em>${esc(job.currentState)}</em></button>`).join('') : `<p>${x(language, 'empty')}</p>`;
      list.querySelectorAll<HTMLElement>('[data-job]').forEach((button) => button.addEventListener('click', () => void open(button.dataset.job!)));
    } catch (error) { reportError(error); list.textContent = x(language, 'error'); }
  }

  async function open(id: string) {
    try {
      renderFile(await carMoverClient.file(id));
      if (!dialog.open) dialog.showModal();
    } catch (error) { reportError(error); }
  }

  function renderFile(file: JobFile) {
    const job = file.job;
    const transitionOptions = (next[job.currentState] || []).map((value) => `<option>${value}</option>`).join('');
    const protocolType = protocolForState(job.currentState);
    const ro = language === 'ro';
    const copy = ro
      ? { takeover:'Preluare', handover:'Predare', km:'Kilometraj', energy:'Combustibil / încărcare %', keys:'Număr chei', notes:'Stare și observații', photos:'Fotografii vehicul', save:'Salvează protocolul', audit:'Referințe audit', evidence:'Referințe dovezi' }
      : { takeover:'Takeover', handover:'Handover', km:'Odometer', energy:'Fuel / charge %', keys:'Key count', notes:'Condition notes', photos:'Vehicle photos', save:'Save protocol', audit:'Audit references', evidence:'Evidence references' };
    const protocol = protocolType ? `<form data-car-mover-protocol><h3>${protocolType === 'TAKEOVER' ? copy.takeover : copy.handover}</h3><input type="hidden" name="protocolType" value="${protocolType}"><label>${copy.km}<input name="odometerKm" type="number" min="0" required></label><label>${copy.energy}<input name="energyPercent" type="number" min="0" max="100"></label><label>${copy.keys}<input name="keyCount" type="number" min="0" max="20" required></label><label>${copy.notes}<textarea name="conditionNotes" maxlength="1000"></textarea></label><label>${copy.photos}<input name="photos" type="file" accept="image/*" capture="environment" multiple></label><button type="submit">${copy.save}</button></form>` : '';
    fileRoot.innerHTML = `<h2>${x(language, 'jobFile')}</h2><p>${x(language, 'readOnly')}</p><dl><dt>${x(language, 'state')}</dt><dd>${esc(job.currentState)}</dd><dt>${x(language, 'vehicleClass')}</dt><dd>${esc(file.vehicle.vehicleClass)}</dd><dt>${x(language, 'vehicleType')}</dt><dd>${esc(file.vehicle.vehicleType)}</dd><dt>${x(language, 'pickup')}</dt><dd>${esc(job.pickupSnapshot.label)}</dd><dt>${x(language, 'destination')}</dt><dd>${esc(job.destinationSnapshot.label)}</dd></dl><h3>${x(language, 'timeline')}</h3><ol>${file.timeline.map((event) => `<li><strong>${esc(event.eventType)}</strong> <time>${esc(event.occurredAt)}</time></li>`).join('')}</ol><h3>${copy.audit}</h3><ul>${file.auditReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('')}</ul><h3>${copy.evidence}</h3><ul>${file.evidenceReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('')}</ul>${protocol}${transitionOptions ? `<form data-transition data-id="${job.id}"><label>${x(language, 'transition')}<select name="toState">${transitionOptions}</select></label><label data-driver-field hidden>${x(language, 'driver')}<input name="assignedDriverUserId"></label><button type="submit">${x(language, 'apply')}</button></form>` : ''}`;

    const protocolForm = fileRoot.querySelector<HTMLFormElement>('[data-car-mover-protocol]');
    protocolForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = new FormData(protocolForm);
        const photos = Array.from((protocolForm.elements.namedItem('photos') as HTMLInputElement).files ?? []).slice(0, 12);
        const photoDigests = await Promise.all(photos.map(async (photo) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await photo.arrayBuffer()))).map((value) => value.toString(16).padStart(2, '0')).join('')));
        await carMoverClient.protocol(job.id, { protocolType:data.get('protocolType'), odometerKm:Number(data.get('odometerKm')), energyPercent:data.get('energyPercent') === '' ? undefined : Number(data.get('energyPercent')), keyCount:Number(data.get('keyCount')), conditionNotes:data.get('conditionNotes') || undefined, photoDigests });
        status.textContent = ro ? 'Protocol salvat.' : 'Protocol saved.';
        await open(job.id);
      } catch (error) { reportError(error); }
    });

    const transitionForm = fileRoot.querySelector<HTMLFormElement>('[data-transition]');
    const select = transitionForm?.elements.namedItem('toState') as HTMLSelectElement | null;
    const driver = transitionForm?.querySelector<HTMLElement>('[data-driver-field]');
    const syncDriver = () => { if (driver && select) driver.hidden = select.value !== 'ASSIGNED'; };
    select?.addEventListener('change', syncDriver);
    syncDriver();
    transitionForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = new FormData(transitionForm);
        await carMoverClient.transition(job.id, { toState:data.get('toState'), assignedDriverUserId:data.get('assignedDriverUserId') || undefined });
        await open(job.id);
        await load();
      } catch (error) { reportError(error); }
    });
  }

  root.querySelector('[data-car-mover-refresh]')?.addEventListener('click', () => void load());
  root.querySelector('[data-car-mover-close]')?.addEventListener('click', () => dialog.close());
  const createForm = root.querySelector<HTMLFormElement>('[data-car-mover-create]');
  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(createForm);
    try {
      await carMoverClient.create({ vehicle:{ vehicleClass:data.get('vehicleClass'), vehicleType:data.get('vehicleType'), make:data.get('make') || undefined, model:data.get('model') || undefined, vin:data.get('vin') || undefined, registration:data.get('registration') || undefined }, pickup:{ label:data.get('pickup') }, destination:{ label:data.get('destination') } });
      status.textContent = x(language, 'saved');
      createForm.reset();
      await load();
    } catch (error) { reportError(error); }
  });
  void load();
}
