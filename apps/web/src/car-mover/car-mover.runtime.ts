import type { BasicLanguageCode } from '../language-registry';
import { carMoverClient, type CarMoverJob, type JobFile } from './car-mover.client';
import type { CarMoverSection } from './car-mover.view';
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

const terminalStates = new Set(['COMPLETED', 'CANCELLED']);
const postTripStates = new Set(['ARRIVED', 'HANDOVER_PENDING', 'COMPLETED']);
const completionStates = new Set(['ARRIVED', 'HANDOVER_PENDING', 'COMPLETED', 'BLOCKED', 'ESCALATED']);

const protocolForState = (state: string) =>
  ['ACCEPTED', 'IN_PROGRESS'].includes(state) ? 'TAKEOVER' :
  ['ARRIVED', 'HANDOVER_PENDING'].includes(state) ? 'HANDOVER' : undefined;

export function bindCarMoverRuntime() {
  const root = document.querySelector<HTMLElement>('[data-car-mover-root]');
  if (!root) return;

  const language = root.dataset.language as BasicLanguageCode;
  const section = root.dataset.carMoverSection as Exclude<CarMoverSection, 'guide'>;
  const list = root.querySelector<HTMLElement>('[data-car-mover-list]');
  const status = root.querySelector<HTMLElement>('[data-car-mover-status]');
  const dialog = root.querySelector<HTMLDialogElement>('[data-car-mover-dialog]');
  const fileRoot = root.querySelector<HTMLElement>('[data-car-mover-file]');
  const offersRoot = root.querySelector<HTMLElement>('[data-car-mover-offers]');
  const providerStatusRoot = root.querySelector<HTMLElement>('[data-car-mover-provider-status]');
  const planningRoot = root.querySelector<HTMLElement>('[data-opportunity-planning]');
  const copilotRoot = root.querySelector<HTMLElement>('[data-opportunity-copilot]');
  const incidentRoot = root.querySelector<HTMLElement>('[data-car-mover-incidents]');
  const incidentJob = root.querySelector<HTMLSelectElement>('[data-car-mover-incident-job]');
  let knownJobs: CarMoverJob[] = [];

  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!);
  const reportError = (error: unknown) => { if (status) status.textContent = error instanceof Error ? error.message : x(language, 'error'); };
  const filteredJobs = (jobs: CarMoverJob[]) => {
    if (section === 'active') return jobs.filter((job) => !terminalStates.has(job.currentState));
    if (section === 'completion') return jobs.filter((job) => completionStates.has(job.currentState));
    if (section === 'accounting') return jobs.filter((job) => postTripStates.has(job.currentState));
    if (section === 'archive') return jobs.filter((job) => terminalStates.has(job.currentState));
    return jobs;
  };

  async function loadJobs() {
    if (!list && !incidentJob) return;
    if (list) list.textContent = x(language, 'loading');
    try {
      knownJobs = await carMoverClient.list();
      const jobs = filteredJobs(knownJobs);
      if (list) {
        list.innerHTML = jobs.length
          ? jobs.map((job) => `<button class="car-mover-job" data-job="${job.id}"><strong>${esc(job.vehicleSubject.make || job.vehicleSubject.vehicleType)} ${esc(job.vehicleSubject.model || '')}</strong><span>${esc(job.pickupSnapshot.label)} → ${esc(job.destinationSnapshot.label)}</span><small>Actualizat ${esc(new Date(job.updatedAt).toLocaleString(language))}</small><em>${esc(job.currentState)}</em></button>`).join('')
          : `<p>${section === 'archive' ? 'Nu există încă curse terminale în arhivă.' : x(language, 'empty')}</p>`;
        list.querySelectorAll<HTMLElement>('[data-job]').forEach((button) => button.addEventListener('click', () => void openJob(button.dataset.job!)));
      }
      if (incidentJob) {
        const current = incidentJob.value;
        incidentJob.innerHTML = `<option value="">Selectați cursa</option>${knownJobs.map((job) => `<option value="${job.id}">${esc(job.pickupSnapshot.label)} → ${esc(job.destinationSnapshot.label)} · ${esc(job.currentState)}</option>`).join('')}`;
        incidentJob.value = current;
      }
    } catch (error) {
      reportError(error);
      if (list) list.textContent = x(language, 'error');
    }
  }

  async function openJob(id: string) {
    if (!dialog || !fileRoot) return;
    try {
      renderFile(await carMoverClient.file(id));
      if (!dialog.open) dialog.showModal();
    } catch (error) { reportError(error); }
  }

  async function loadOffers() {
    if (!offersRoot) return;
    try {
      const offers = await carMoverClient.offers();
      offersRoot.innerHTML = offers.length ? offers.map((offer) => `<article class="car-mover-offer"><header><strong>${esc(offer.platformName)}</strong><span>${esc(offer.status)} · scor ${esc(offer.score)}/100</span></header><p>${esc(offer.pickupLabel ?? '—')} → ${esc(offer.destinationLabel ?? '—')}</p><dl><dt>Vehicul</dt><dd>${esc(offer.vehicleDescription ?? 'NECONFIRMAT')}</dd><dt>Ofertă</dt><dd>${esc(offer.offeredAmount ?? '—')} ${esc(offer.currencyCode ?? '')}</dd><dt>Distanță</dt><dd>${esc(offer.estimatedKm ?? '—')} km</dd><dt>Încredere extragere</dt><dd>${esc(offer.extractionConfidence)}%</dd></dl><p>${esc(offer.analysis?.reason ?? 'Necesită verificare umană.')}</p>${offer.status === 'NEW' ? `<div><button type="button" data-review-offer="${offer.id}" data-offer-status="REVIEWED">Marchează verificată</button><button type="button" data-review-offer="${offer.id}" data-offer-status="DISMISSED">Respinge</button></div>` : ''}</article>`).join('') : '<p>Nu există oferte care îndeplinesc criteriile minime.</p>';
    } catch (error) { offersRoot.textContent = error instanceof Error ? error.message : 'Ofertele nu au putut fi încărcate.'; }
  }

  async function loadProviderStatus() {
    if (!providerStatusRoot) return;
    try {
      const providers = await carMoverClient.providerStatus();
      providerStatusRoot.textContent = providers.map((provider) => `${provider.channel === 'email' ? 'Gmail' : 'WhatsApp'}: ${provider.configured ? 'CONFIGURAT' : 'NECONFIGURAT'}`).join(' · ');
    } catch { providerStatusRoot.textContent = 'Starea furnizorilor nu poate fi verificată.'; }
  }

  async function loadPlanning() {
    if (!planningRoot || !copilotRoot) return;
    try {
      const [items, copilot] = await Promise.all([carMoverClient.planning(), carMoverClient.copilot()]);
      const latest = new Map<string, (typeof items)[number]>();
      for (const item of items) if (!latest.has(item.chain.chainKey)) latest.set(item.chain.chainKey, item);
      const variants = [...latest.values()].sort((a,b) => Number(b.chain.metrics.estimatedGrossProfit ?? 0) - Number(a.chain.metrics.estimatedGrossProfit ?? 0));
      copilotRoot.textContent = copilot.variantCount ? `Am găsit ${copilot.variantCount} variante. ${copilot.recommendation === 'BEST_FRESH_RECOMMENDED_VARIANT' ? 'Prima este recomandarea curentă, dar decizia rămâne la dvs.' : 'Este necesară verificarea umană.'}` : 'Nu există încă variante publicate.';
      planningRoot.innerHTML = variants.length ? `<div class="car-mover-planning-grid">${variants.map((item,index) => {
        const metrics = item.chain.metrics;
        const stale = item.verdict.freshnessStatus !== 'FRESH';
        const decided = item.humanDecision;
        return `<article class="car-mover-variant" data-state="${esc(item.verdict.classification)}"><header><strong>Varianta ${index + 1}</strong><span>${esc(item.verdict.classification)} · ${esc(item.verdict.confidence)}%</span></header><p>${Array.isArray(item.chain.opportunityIds) ? item.chain.opportunityIds.length : 0} curse · versiunea ${esc(item.chain.version)}</p><dl><dt>Profit estimat</dt><dd>${esc(metrics.estimatedGrossProfit)} EUR</dd><dt>Profit / km</dt><dd>${esc(metrics.estimatedProfitPerKm)} EUR</dd><dt>Profit / oră</dt><dd>${esc(metrics.estimatedProfitPerHour)} EUR</dd><dt>Km goi</dt><dd>${esc(metrics.emptyKm)} km</dd><dt>Față de casă</dt><dd>${esc(metrics.finalHomeDistanceKm)} km</dd></dl>${stale ? '<p>Date STALE: recalcularea este necesară înainte de acceptare.</p>' : ''}${decided ? `<p><strong>Decizie: ${esc(decided.decision)}</strong></p>` : `<div class="car-mover-variant-actions"><button type="button" data-opportunity-decision="ACCEPT" data-verdict-id="${item.verdict.id}" ${stale || item.verdict.classification === 'REJECT' ? 'disabled' : ''}>Acceptă și creează Job File</button><button type="button" data-opportunity-decision="REJECT" data-verdict-id="${item.verdict.id}">Refuză</button></div>`}</article>`;
      }).join('')}</div>` : '<p>Nu există încă variante calculate. Fluxul manual Car Mover rămâne disponibil.</p>';
      renderLiveMobility(items);
    } catch (error) {
      planningRoot.textContent = error instanceof Error ? error.message : 'Planning nu este disponibil.';
      copilotRoot.textContent = 'Opportunity Intelligence este un accelerator, nu un blocaj operațional.';
    }
  }

  function renderLiveMobility(items: Awaited<ReturnType<typeof carMoverClient.planning>>) {
    if (!planningRoot) return;
    const latest = new Map<string, (typeof items)[number]>();
    for (const item of items) if (!latest.has(item.chain.chainKey)) latest.set(item.chain.chainKey, item);
    const variants = [...latest.values()].sort((a,b) => Number(b.chain.metrics.estimatedGrossProfit ?? 0) - Number(a.chain.metrics.estimatedGrossProfit ?? 0));
    planningRoot.querySelectorAll<HTMLElement>('.car-mover-variant').forEach((card,index) => {
      const item = variants[index];
      if (!item) return;
      const mobility = item.mobilitySummary;
      const estimatedCost = Number(item.chain.metrics.estimatedTotalCost ?? item.chain.metrics.estimatedCost ?? 0);
      card.insertAdjacentHTML('beforeend', `<section class="car-mover-live-mobility"><h4>Mobilitate live</h4><dl><dt>Sursă</dt><dd>${esc(mobility.sources.join(', ') || 'Fără date live')}</dd><dt>Distanță</dt><dd>${esc(mobility.distanceKm)} km</dd><dt>Timp</dt><dd>${esc(mobility.durationMinutes)} min</dd><dt>Cost estimat</dt><dd>${esc(estimatedCost)} EUR</dd><dt>Repoziționare</dt><dd>${esc(mobility.repositionKm)} km</dd><dt>Freshness</dt><dd>${esc(mobility.freshnessStatus)}${mobility.validUntil ? ` · ${esc(new Date(mobility.validUntil).toLocaleString(language))}` : ''}</dd></dl>${mobility.warnings.map((warning) => `<p class="car-mover-live-warning">${esc(warning)}</p>`).join('')}</section>`);
    });
  }

  async function loadIncidents() {
    if (!incidentRoot) return;
    try {
      const jobIds = new Set(knownJobs.map((job) => job.id));
      const incidents = (await carMoverClient.incidents()).filter((incident) => jobIds.has(incident.transportJobId));
      incidentRoot.innerHTML = incidents.length ? `<h3>Incidente Car Mover</h3>${incidents.map((incident) => `<article class="car-mover-incident" data-status="${esc(incident.status)}"><header><strong>${esc(incident.title)}</strong><span>${esc(incident.severity)} · ${esc(incident.status)}</span></header><p>${esc(incident.description || incident.incidentType)}</p><small>${esc(new Date(incident.createdAt).toLocaleString(language))}</small>${incident.status !== 'resolved' ? `<button type="button" data-resolve-incident="${incident.id}">Marchează rezolvat</button>` : ''}</article>`).join('')}` : '<p>Nu există incidente Car Mover înregistrate.</p>';
    } catch (error) { incidentRoot.textContent = error instanceof Error ? error.message : 'Incidentele nu au putut fi încărcate.'; }
  }

  function renderFile(file: JobFile) {
    if (!fileRoot) return;
    const job = file.job;
    const transitionOptions = (next[job.currentState] || []).map((value) => `<option>${value}</option>`).join('');
    const protocolType = protocolForState(job.currentState);
    const allowOperations = section === 'active' || section === 'completion';
    const allowAccounting = section === 'accounting';
    const allowWrites = section !== 'archive';
    const protocol = allowOperations && protocolType ? `<form data-car-mover-protocol><h3>${protocolType === 'TAKEOVER' ? 'Pickup / Preluare' : 'Handover / Predare'}</h3><p>Camera și OCR se folosesc numai pentru excepții/dovezi.</p><input type="hidden" name="protocolType" value="${protocolType}"><label>Kilometraj<input name="odometerKm" type="number" min="0" required></label><label>Combustibil / încărcare %<input name="energyPercent" type="number" min="0" max="100"></label><label>Număr chei<input name="keyCount" type="number" min="0" max="20" required></label><label>Stare și observații<textarea name="conditionNotes" maxlength="1000"></textarea></label><label>Fotografii excepție<input name="photos" type="file" accept="image/*" capture="environment" multiple></label><button type="submit">Salvează protocolul</button></form>` : '';
    const accounting = allowAccounting ? `<section><h3>Contabilitate primară · ACTUAL</h3><ol>${file.financialEntries.map((entry) => `<li>${esc(entry.entryType)} · ${esc(entry.category)} · ${esc(entry.amount)} ${esc(entry.currencyCode)}</li>`).join('') || '<li>Nicio înregistrare.</li>'}</ol><form data-car-mover-finance><label>Tip<select name="entryType"><option>REVENUE</option><option>COST</option><option>PAYMENT</option></select></label><label>Categorie<input name="category" required maxlength="64"></label><label>Sumă actuală<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Monedă<input name="currencyCode" value="EUR" minlength="3" maxlength="3" required></label><label>Data<input name="occurredAt" type="date" required></label><label>Descriere<input name="description" maxlength="500"></label><button type="submit">Înregistrează valoarea reală</button></form><h3>Facturi</h3><ol>${file.invoices.map((invoice) => `<li>${esc(invoice.direction)} · ${esc(invoice.invoiceNumber)} · ${esc(invoice.amount)} ${esc(invoice.currencyCode)} · ${esc(invoice.status)}</li>`).join('') || '<li>Nicio factură.</li>'}</ol><form data-car-mover-invoice><label>Direcție<select name="direction"><option>ISSUED</option><option>RECEIVED</option></select></label><label>Număr<input name="invoiceNumber" required maxlength="120"></label><label>Partener<input name="counterparty" required maxlength="240"></label><label>Sumă<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Monedă<input name="currencyCode" value="EUR" minlength="3" maxlength="3" required></label><label>Data emiterii<input name="issueDate" type="date" required></label><label>Scadență<input name="dueDate" type="date"></label><button type="submit">Înregistrează factura</button></form></section>` : '';
    const communications = section === 'active' ? `<section><h3>Comunicare asociată cursei</h3><ol>${file.communications.flatMap((conversation) => conversation.messages).map((message) => `<li>${esc(message.direction)} · ${esc(message.status)} · ${esc(message.bodyText)}</li>`).join('') || '<li>Nicio comunicare asociată.</li>'}</ol><form data-car-mover-message><label>Canal<select name="channel"><option value="email">Gmail</option><option value="whatsapp">WhatsApp</option></select></label><label>Destinatar<input name="to" required></label><label>Subiect<input name="subject"></label><label>Mesaj<textarea name="bodyText" required maxlength="20000"></textarea></label><button type="submit">Trimite controlat</button></form></section>` : '';
    const transition = allowOperations && allowWrites && transitionOptions ? `<form data-transition data-id="${job.id}"><label>${x(language,'transition')}<select name="toState">${transitionOptions}</select></label><label data-driver-field hidden>${x(language,'driver')}<input name="assignedDriverUserId"></label><button type="submit">${x(language,'apply')}</button></form>` : '';

    fileRoot.innerHTML = `<h2>${x(language,'jobFile')}</h2><p>Proiecție operațională AGM · ${section === 'archive' ? 'READ-ONLY ARCHIVE' : 'date curente'}</p><dl><dt>${x(language,'state')}</dt><dd>${esc(job.currentState)}</dd><dt>${x(language,'vehicleClass')}</dt><dd>${esc(file.vehicle.vehicleClass)}</dd><dt>${x(language,'vehicleType')}</dt><dd>${esc(file.vehicle.vehicleType)}</dd><dt>${x(language,'pickup')}</dt><dd>${esc(job.pickupSnapshot.label)}</dd><dt>${x(language,'destination')}</dt><dd>${esc(job.destinationSnapshot.label)}</dd></dl>${allowAccounting ? `<section class="car-mover-analysis"><h3>Analiza cursei</h3><p>Estimările sunt afișate separat și nu sunt copiate ca valori actuale.</p><dl><dt>Venituri actuale</dt><dd>${esc(file.analysis.revenue)} ${esc(file.analysis.currencyCode ?? '')}</dd><dt>Costuri actuale</dt><dd>${esc(file.analysis.cost)} ${esc(file.analysis.currencyCode ?? '')}</dd><dt>Marjă actuală</dt><dd>${esc(file.analysis.margin)} ${esc(file.analysis.currencyCode ?? '')}</dd><dt>Plăți</dt><dd>${esc(file.analysis.payments)} ${esc(file.analysis.currencyCode ?? '')}</dd></dl></section>` : ''}${accounting}${communications}<h3>${x(language,'timeline')}</h3><ol>${file.timeline.map((event) => `<li><strong>${esc(event.eventType)}</strong> <time>${esc(event.occurredAt)}</time></li>`).join('')}</ol><h3>Referințe audit</h3><ul>${file.auditReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('') || '<li>Nicio referință.</li>'}</ul><h3>Referințe dovezi</h3><ul>${file.evidenceReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('') || '<li>Nicio referință.</li>'}</ul>${protocol}${transition}`;

    bindFileForms(file);
  }

  function bindFileForms(file: JobFile) {
    if (!fileRoot) return;
    const job = file.job;
    const financeForm = fileRoot.querySelector<HTMLFormElement>('[data-car-mover-finance]');
    const invoiceForm = fileRoot.querySelector<HTMLFormElement>('[data-car-mover-invoice]');
    const messageForm = fileRoot.querySelector<HTMLFormElement>('[data-car-mover-message]');
    financeForm?.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(financeForm); await carMoverClient.finance(job.id,{entryType:data.get('entryType'),category:data.get('category'),amount:String(data.get('amount')),currencyCode:data.get('currencyCode'),occurredAt:new Date(String(data.get('occurredAt'))).toISOString(),description:data.get('description')||undefined}); await openJob(job.id); } catch (error) { reportError(error); } });
    invoiceForm?.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(invoiceForm); await carMoverClient.invoice(job.id,{direction:data.get('direction'),invoiceNumber:data.get('invoiceNumber'),counterparty:data.get('counterparty'),amount:String(data.get('amount')),currencyCode:data.get('currencyCode'),issueDate:new Date(String(data.get('issueDate'))).toISOString(),dueDate:data.get('dueDate')?new Date(String(data.get('dueDate'))).toISOString():undefined}); await openJob(job.id); } catch (error) { reportError(error); } });
    messageForm?.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(messageForm); await carMoverClient.sendMessage({channel:data.get('channel'),to:data.get('to'),subject:data.get('subject')||undefined,bodyText:data.get('bodyText'),tripId:job.id}); await openJob(job.id); } catch (error) { reportError(error); } });

    const protocolForm = fileRoot.querySelector<HTMLFormElement>('[data-car-mover-protocol]');
    protocolForm?.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(protocolForm); const photos = Array.from((protocolForm.elements.namedItem('photos') as HTMLInputElement).files ?? []).slice(0,12); const photoDigests = await Promise.all(photos.map(async (photo) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await photo.arrayBuffer()))).map((value) => value.toString(16).padStart(2,'0')).join(''))); await carMoverClient.protocol(job.id,{protocolType:data.get('protocolType'),odometerKm:Number(data.get('odometerKm')),energyPercent:data.get('energyPercent')===''?undefined:Number(data.get('energyPercent')),keyCount:Number(data.get('keyCount')),conditionNotes:data.get('conditionNotes')||undefined,photoDigests}); if (status) status.textContent = 'Protocol salvat.'; await openJob(job.id); } catch (error) { reportError(error); } });

    const transitionForm = fileRoot.querySelector<HTMLFormElement>('[data-transition]');
    const select = transitionForm?.elements.namedItem('toState') as HTMLSelectElement | null;
    const driver = transitionForm?.querySelector<HTMLElement>('[data-driver-field]');
    const syncDriver = () => { if (driver && select) driver.hidden = select.value !== 'ASSIGNED'; };
    select?.addEventListener('change', syncDriver); syncDriver();
    transitionForm?.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(transitionForm); await carMoverClient.transition(job.id,{toState:data.get('toState'),assignedDriverUserId:data.get('assignedDriverUserId')||undefined}); await openJob(job.id); await loadJobs(); } catch (error) { reportError(error); } });
  }

  root.querySelector('[data-car-mover-refresh]')?.addEventListener('click', () => void loadJobs());
  root.querySelector('[data-opportunity-refresh]')?.addEventListener('click', () => void loadPlanning());
  root.querySelector('[data-car-mover-analyze]')?.addEventListener('click', async () => { try { const result = await carMoverClient.analyzeOffers(); if (status) status.textContent = `${result.sync.ingested} mesaje Gmail sincronizate · ${result.created} oportunități noi din ${result.scanned} mesaje.`; await loadOffers(); } catch (error) { reportError(error); } });
  offersRoot?.addEventListener('click', async (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-review-offer]'); if (!button?.dataset.reviewOffer) return; try { await carMoverClient.reviewOffer(button.dataset.reviewOffer,{status:button.dataset.offerStatus}); await loadOffers(); } catch (error) { reportError(error); } });
  planningRoot?.addEventListener('click', async (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-opportunity-decision]'); const verdictId = button?.dataset.verdictId; const decision = button?.dataset.opportunityDecision as 'ACCEPT'|'REJECT'|undefined; if (!button || !verdictId || !decision) return; if (decision === 'ACCEPT' && !window.confirm('Confirmați decizia umană? Job File va fi creat numai după această confirmare.')) return; button.disabled = true; try { const result = await carMoverClient.decide(verdictId,{decisionKey:crypto.randomUUID(),decision,reason:'Decizie explicită din Car Mover Planning'}); if (status) status.textContent = decision === 'ACCEPT' ? `${result.jobLinks.length} Job File creat(e).` : 'Varianta a fost refuzată.'; await loadPlanning(); } catch (error) { button.disabled = false; reportError(error); } });
  incidentRoot?.addEventListener('click', async (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-resolve-incident]'); if (!button?.dataset.resolveIncident) return; try { await carMoverClient.resolveIncident(button.dataset.resolveIncident,{resolutionNotes:'Rezolvare confirmată explicit din Car Mover Completion.'}); await loadIncidents(); } catch (error) { reportError(error); } });
  root.querySelector('[data-car-mover-close]')?.addEventListener('click', () => dialog?.close());

  const incidentForm = root.querySelector<HTMLFormElement>('[data-car-mover-incident]');
  incidentForm?.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(incidentForm); try { await carMoverClient.createIncident({transportJobId:data.get('transportJobId'),incidentType:data.get('incidentType'),severity:data.get('severity'),title:data.get('title'),description:data.get('description')||undefined}); incidentForm.reset(); if (status) status.textContent = 'Incident File creat. Aplicația și fluxul manual rămân disponibile.'; await loadIncidents(); } catch (error) { reportError(error); } });

  const createForm = root.querySelector<HTMLFormElement>('[data-car-mover-create]');
  createForm?.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(createForm); try { await carMoverClient.create({vehicle:{vehicleClass:data.get('vehicleClass'),vehicleType:data.get('vehicleType'),make:data.get('make')||undefined,model:data.get('model')||undefined,vin:data.get('vin')||undefined,registration:data.get('registration')||undefined},pickup:{label:data.get('pickup')},destination:{label:data.get('destination')}}); if (status) status.textContent = x(language,'saved'); createForm.reset(); await loadJobs(); } catch (error) { reportError(error); } });

  if (section === 'planning') void Promise.all([loadOffers(), loadProviderStatus(), loadPlanning()]);
  if (section === 'completion') void loadJobs().then(loadIncidents);
  else void loadJobs();
}
