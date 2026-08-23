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
  const offersRoot = root.querySelector<HTMLElement>('[data-car-mover-offers]')!;
  const providerStatusRoot = root.querySelector<HTMLElement>('[data-car-mover-provider-status]')!;
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

  async function loadOffers() {
    try {
      const offers=await carMoverClient.offers();
      offersRoot.innerHTML=offers.length?offers.map((offer)=>`<article class="car-mover-offer"><header><strong>${esc(offer.platformName)}</strong><span>${esc(offer.status)} · scor ${esc(offer.score)}/100</span></header><p>${esc(offer.pickupLabel??'—')} → ${esc(offer.destinationLabel??'—')}</p><dl><dt>Vehicul</dt><dd>${esc(offer.vehicleDescription??'NECONFIRMAT')}</dd><dt>Ofertă</dt><dd>${esc(offer.offeredAmount??'—')} ${esc(offer.currencyCode??'')}</dd><dt>Distanță</dt><dd>${esc(offer.estimatedKm??'—')} km</dd><dt>Încredere extragere</dt><dd>${esc(offer.extractionConfidence)}%</dd></dl><p>${esc(offer.analysis?.reason??'Necesită verificare umană.')}</p>${offer.status==='NEW'?`<div><button type="button" data-review-offer="${offer.id}" data-offer-status="REVIEWED">Marchează verificată</button><button type="button" data-review-offer="${offer.id}" data-offer-status="DISMISSED">Respinge</button></div>`:''}</article>`).join(''):'<p>Nu există alerte Gmail/WhatsApp care îndeplinesc criteriile minime de ofertă.</p>';
    } catch(error){offersRoot.textContent=error instanceof Error?error.message:'Propunerile nu au putut fi încărcate.';}
  }

  async function loadProviderStatus(){try{const providers=await carMoverClient.providerStatus();providerStatusRoot.textContent=providers.map((provider)=>`${provider.channel==='email'?'Gmail':'WhatsApp'}: ${provider.configured?'CONFIGURAT':'NECONFIGURAT'}`).join(' · ');}catch{providerStatusRoot.textContent='Starea furnizorilor nu poate fi verificată.';}}

  function renderFile(file: JobFile) {
    const job = file.job;
    const transitionOptions = (next[job.currentState] || []).map((value) => `<option>${value}</option>`).join('');
    const protocolType = protocolForState(job.currentState);
    const ro = language === 'ro';
    const copy = ro
      ? { takeover:'Preluare', handover:'Predare', km:'Kilometraj', energy:'Combustibil / încărcare %', keys:'Număr chei', notes:'Stare și observații', photos:'Fotografii vehicul', save:'Salvează protocolul', audit:'Referințe audit', evidence:'Referințe dovezi' }
      : { takeover:'Takeover', handover:'Handover', km:'Odometer', energy:'Fuel / charge %', keys:'Key count', notes:'Condition notes', photos:'Vehicle photos', save:'Save protocol', audit:'Audit references', evidence:'Evidence references' };
    const protocol = protocolType ? `<form data-car-mover-protocol><h3>${protocolType === 'TAKEOVER' ? copy.takeover : copy.handover}</h3><input type="hidden" name="protocolType" value="${protocolType}"><label>${copy.km}<input name="odometerKm" type="number" min="0" required></label><label>${copy.energy}<input name="energyPercent" type="number" min="0" max="100"></label><label>${copy.keys}<input name="keyCount" type="number" min="0" max="20" required></label><label>${copy.notes}<textarea name="conditionNotes" maxlength="1000"></textarea></label><label>${copy.photos}<input name="photos" type="file" accept="image/*" capture="environment" multiple></label><button type="submit">${copy.save}</button></form>` : '';
    fileRoot.innerHTML = `<h2>${x(language, 'jobFile')}</h2><p>${x(language, 'readOnly')}</p><dl><dt>${x(language, 'state')}</dt><dd>${esc(job.currentState)}</dd><dt>${x(language, 'vehicleClass')}</dt><dd>${esc(file.vehicle.vehicleClass)}</dd><dt>${x(language, 'vehicleType')}</dt><dd>${esc(file.vehicle.vehicleType)}</dd><dt>${x(language, 'pickup')}</dt><dd>${esc(job.pickupSnapshot.label)}</dd><dt>${x(language, 'destination')}</dt><dd>${esc(job.destinationSnapshot.label)}</dd></dl><section class="car-mover-analysis"><h3>Analiza cursei</h3><dl><dt>Venituri</dt><dd>${esc(file.analysis.revenue)} ${esc(file.analysis.currencyCode??'')}</dd><dt>Costuri</dt><dd>${esc(file.analysis.cost)} ${esc(file.analysis.currencyCode??'')}</dd><dt>Marjă</dt><dd>${esc(file.analysis.margin)} ${esc(file.analysis.currencyCode??'')}</dd><dt>Plăți</dt><dd>${esc(file.analysis.payments)} ${esc(file.analysis.currencyCode??'')}</dd></dl></section><section><h3>Contabilitate primară</h3><ol>${file.financialEntries.map((entry)=>`<li>${esc(entry.entryType)} · ${esc(entry.category)} · ${esc(entry.amount)} ${esc(entry.currencyCode)}</li>`).join('')||'<li>Nicio înregistrare.</li>'}</ol><form data-car-mover-finance><label>Tip<select name="entryType"><option>REVENUE</option><option>COST</option><option>PAYMENT</option></select></label><label>Categorie<input name="category" required maxlength="64"></label><label>Sumă<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Monedă<input name="currencyCode" value="EUR" minlength="3" maxlength="3" required></label><label>Data<input name="occurredAt" type="date" required></label><label>Descriere<input name="description" maxlength="500"></label><button type="submit">Înregistrează</button></form><h3>Facturi</h3><ol>${file.invoices.map((invoice)=>`<li>${esc(invoice.direction)} · ${esc(invoice.invoiceNumber)} · ${esc(invoice.amount)} ${esc(invoice.currencyCode)} · ${esc(invoice.status)}</li>`).join('')||'<li>Nicio factură.</li>'}</ol><form data-car-mover-invoice><label>Direcție<select name="direction"><option>ISSUED</option><option>RECEIVED</option></select></label><label>Număr<input name="invoiceNumber" required maxlength="120"></label><label>Partener<input name="counterparty" required maxlength="240"></label><label>Sumă<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Monedă<input name="currencyCode" value="EUR" minlength="3" maxlength="3" required></label><label>Data emiterii<input name="issueDate" type="date" required></label><label>Scadență<input name="dueDate" type="date"></label><button type="submit">Înregistrează factura</button></form></section><section><h3>Gmail / WhatsApp asociat cursei</h3><ol>${file.communications.flatMap((conversation)=>conversation.messages).map((message)=>`<li>${esc(message.direction)} · ${esc(message.status)} · ${esc(message.bodyText)}</li>`).join('')||'<li>Nicio comunicare asociată.</li>'}</ol><form data-car-mover-message><label>Canal<select name="channel"><option value="email">Gmail</option><option value="whatsapp">WhatsApp</option></select></label><label>Destinatar<input name="to" required></label><label>Subiect<input name="subject"></label><label>Mesaj<textarea name="bodyText" required maxlength="20000"></textarea></label><button type="submit">Trimite controlat</button></form></section><h3>${x(language, 'timeline')}</h3><ol>${file.timeline.map((event) => `<li><strong>${esc(event.eventType)}</strong> <time>${esc(event.occurredAt)}</time></li>`).join('')}</ol><h3>${copy.audit}</h3><ul>${file.auditReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('')}</ul><h3>${copy.evidence}</h3><ul>${file.evidenceReferences.map((reference) => `<li><code>${esc(reference)}</code></li>`).join('')}</ul>${protocol}${transitionOptions ? `<form data-transition data-id="${job.id}"><label>${x(language, 'transition')}<select name="toState">${transitionOptions}</select></label><label data-driver-field hidden>${x(language, 'driver')}<input name="assignedDriverUserId"></label><button type="submit">${x(language, 'apply')}</button></form>` : ''}`;

    const financeForm=fileRoot.querySelector<HTMLFormElement>('[data-car-mover-finance]');
    const invoiceForm=fileRoot.querySelector<HTMLFormElement>('[data-car-mover-invoice]');
    const messageForm=fileRoot.querySelector<HTMLFormElement>('[data-car-mover-message]');
    financeForm?.addEventListener('submit',async(event)=>{event.preventDefault();try{const data=new FormData(financeForm);await carMoverClient.finance(job.id,{entryType:data.get('entryType'),category:data.get('category'),amount:String(data.get('amount')),currencyCode:data.get('currencyCode'),occurredAt:new Date(String(data.get('occurredAt'))).toISOString(),description:data.get('description')||undefined});await open(job.id);}catch(error){reportError(error);}});
    invoiceForm?.addEventListener('submit',async(event)=>{event.preventDefault();try{const data=new FormData(invoiceForm);await carMoverClient.invoice(job.id,{direction:data.get('direction'),invoiceNumber:data.get('invoiceNumber'),counterparty:data.get('counterparty'),amount:String(data.get('amount')),currencyCode:data.get('currencyCode'),issueDate:new Date(String(data.get('issueDate'))).toISOString(),dueDate:data.get('dueDate')?new Date(String(data.get('dueDate'))).toISOString():undefined});await open(job.id);}catch(error){reportError(error);}});
    messageForm?.addEventListener('submit',async(event)=>{event.preventDefault();try{const data=new FormData(messageForm);await carMoverClient.sendMessage({channel:data.get('channel'),to:data.get('to'),subject:data.get('subject')||undefined,bodyText:data.get('bodyText'),tripId:job.id});await open(job.id);}catch(error){reportError(error);}});

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
  root.querySelector('[data-car-mover-analyze]')?.addEventListener('click',async()=>{try{const result=await carMoverClient.analyzeOffers();status.textContent=`${result.created} propuneri noi din ${result.scanned} mesaje verificate.`;await loadOffers();}catch(error){reportError(error);}});
  offersRoot.addEventListener('click',async(event)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-review-offer]');if(!button?.dataset.reviewOffer)return;try{await carMoverClient.reviewOffer(button.dataset.reviewOffer,{status:button.dataset.offerStatus});await loadOffers();}catch(error){reportError(error);}});
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
  void loadOffers();
  void loadProviderStatus();
}
