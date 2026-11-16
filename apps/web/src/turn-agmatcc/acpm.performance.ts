import { selectAcpm, type AcpmSnapshot, type AcpmFilters } from '@agm/shared';
import { authenticatedApiFetch } from '../authenticated-api';

export const acpmPanel = `<section class="acpm-performance agmatcc-performance" aria-label="Agent & Chain Performance Monitor">
  <h3>ACPM · Agent &amp; Chain Performance Monitor</h3>
  <p>Citirea necesită autentificarea contului OWNER AGM. PIN-ul TURN nu acordă acest rol.</p>
  <p>Observare și analiză. ACP — Authority Control Plane păstrează autoritatea, permisiunile și guvernanța.</p>
  <p>Execuții observate, transferuri și performanță. Lipsa datelor nu confirmă funcționarea.</p>
  <button type="button" data-acpm-refresh>Actualizează ACPM</button>
  <fieldset class="acpm-filters"><legend>Consultare manuală</legend>
    <label>Tip componentă<select data-acpm-kind><option value="">Toate tipurile</option></select></label>
    <label>Componentă<select data-acpm-component><option value="">Toate componentele</option></select></label>
    <label>Departament<select data-acpm-department><option value="">Toate departamentele</option></select></label>
    <label>De la (ora locală)<input type="datetime-local" data-acpm-from></label>
    <label>Până la (ora locală)<input type="datetime-local" data-acpm-to></label>
    <button type="button" data-acpm-apply>Aplică filtrele</button>
    <button type="button" data-acpm-reset>Resetează filtrele</button>
  </fieldset>
  <p role="status" data-acpm-status>Încă neîncărcat.</p><div data-acpm-content></div>
</section>`;
const duration = (ms: number | null) => ms === null ? 'nedemonstrat' : `${(ms/1000).toFixed(2)} s`;
export function renderAcpm(target: HTMLElement, snapshot: AcpmSnapshot & {inventory?:Array<{componentId:string;kind:string;module:string;supervisorId:string|null;observation:string}>}) {
  target.replaceChildren();
  const p = (text: string) => { const node=document.createElement('p'); node.textContent=text; target.append(node); };
  p(`Observat la ${snapshot.observedAt} · ${snapshot.runs.length} execuții · ${snapshot.chains.length} lanțuri · ${snapshot.departments.length} departamente identificate`);
  p('Acoperire: numai evenimente instrumentate. Nu este o certificare a întregii organizații.');
  const health=snapshot.observerHealth;
  if(health) p(`Instrumentare API de la ${health.startedAt}: persistate ${health.persisted}/${health.accepted}, pending ${health.pending}, erori ${health.failed}, omise ${health.dropped}, identitate indisponibila ${health.missingIdentity}. Contorii sunt locali procesului; evenimentele confirmate sunt in PostgreSQL. Acoperirea intregului lant nu este certificata.`);
  else p('Starea instrumentarii automate este indisponibila pentru aceasta sursa.');
  p('Durata activa este timpul scurs in afara asteptarilor instrumentate, nu timpul CPU. Asteptarile au acoperire partiala. Lipsa capacity/model/version/departament nu este completata prin presupuneri.');
  if(snapshot.inventory) {
    const inventory=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=`Registru: ${snapshot.inventory.length} componente declarate · ${snapshot.inventory.filter(n=>n.observation==='NO_PERFORMANCE_EVENTS').length} fără observații în sursa consultată`;inventory.append(summary);
    for(const n of snapshot.inventory){const line=document.createElement('p');line.textContent=`${n.componentId} · ${n.kind} · modul ${n.module} · supervisor ${n.supervisorId??'niciunul'} · ${n.observation}`;inventory.append(line);}target.append(inventory);
  }
  if(snapshot.truncated || snapshot.issues.length) p(`Date incomplete: ${snapshot.truncated ? 'limită de citire atinsă; ' : ''}${snapshot.issues.join(', ')}`);
  if(!snapshot.runs.length) p('Date indisponibile pentru selecția curentă. Nu există execuții observate și nu se generează rezultate demonstrative.');
  const table=document.createElement('table');
  const head=document.createElement('tr');
  for(const label of ['Componentă / mandat','Stare','Activ / suspendat / total','Dovezi']) { const th=document.createElement('th'); th.scope='col'; th.textContent=label; head.append(th); }
  const thead=document.createElement('thead'); thead.append(head); table.append(thead);
  const body=document.createElement('tbody');
  for(const run of snapshot.runs) {
    const tr=document.createElement('tr');
    const declaredKind=snapshot.inventory?.find(n=>n.componentId===run.componentId)?.kind;
    const role=run.componentKind==='UNKNOWN'&&declaredKind?`${declaredKind} declarat; rol neprecizat în eveniment`:run.componentKind;
    for(const text of [`${run.componentId} (${role}) · ${run.mandateId} · ${run.departmentId ?? 'departament necunoscut'}`,run.status,`${duration(run.activeMs)} / ${duration(run.suspendedMs)} / ${duration(run.wallMs)}`]) { const td=document.createElement('td'); td.textContent=text;tr.append(td); }
    const td=document.createElement('td'), details=document.createElement('details'), summary=document.createElement('summary'); summary.textContent=`${run.events.length} evenimente · ${run.issues.length} limite`; details.append(summary);
    for(const e of run.events) { const line=document.createElement('p');const origin=e.source==='ACP'?'ACPM (format de stocare v1)':'Telemetrie preexistentă';line.textContent=`${e.eventId} · ${e.kind} · ${e.occurredAt} · ${origin} · ${e.evidenceRef} · SHA-256 ${e.evidenceHash ?? 'indisponibil'}`;details.append(line); }
    const notes=document.createElement('p'); notes.textContent=run.issues.join(', ');details.append(notes);td.append(details);tr.append(td);body.append(tr);
  }
  for(const row of Array.from(body.rows)) Array.from(row.cells).forEach((cell,i)=>{cell.dataset.label=['Componentă / mandat','Stare','Activ / suspendat / total','Dovezi'][i];});
  table.append(body);const tableRegion=document.createElement('div');tableRegion.className='acpm-table-region';tableRegion.tabIndex=0;tableRegion.setAttribute('role','region');tableRegion.setAttribute('aria-label','Execuții ACPM — listă derulabilă');tableRegion.append(table);target.append(tableRegion);
  for(const transfer of snapshot.transfers) p(`Transfer ${transfer.from} → ${transfer.to ?? 'necunoscut'}: ${transfer.acceptedByEventId ? 'acceptare observată '+transfer.acceptedByEventId : 'acceptare nedemonstrată'} · ${transfer.evidenceRef}`);
  for(const block of snapshot.blocks) p(`Blocaj — clasificare înregistrată ${block.classification}: ${block.reason} · decizie ${block.decisionRef ?? 'neînregistrată'} · ${block.evidenceRef}`);
  for(const correction of snapshot.corrections ?? []) p(`Corecție append-only ${correction.eventId} pentru ${correction.supersedesEventId}: ${correction.reason}. Original păstrat: ${correction.original.evidenceRef}`);
  if(!snapshot.comparisons.some(c=>c.comparable)) p('Comparații modele: date insuficiente; minimum 3 execuții complete per model, pentru minimum 2 modele în condiții echivalente.');
  for(const c of snapshot.comparisons) { p(`Cohortă ${c.cohort} · ${c.comparable ? 'comparabilă descriptiv; nu dovedește superioritate cauzală' : 'eșantion insuficient'}`); for(const m of c.models) p(`${m.model} · n=${m.samples} · mediană activă ${duration(m.medianActiveMs)} · dovezi ${m.evidenceEventIds.join(', ')}`); }
  for(const s of snapshot.signals) p(`${s.kind} · ${s.componentId}: ${s.detail} · ${s.evidenceEventIds.join(', ')}`);
  if(!snapshot.signals.length) p('Niciun semnal calculabil în datele disponibile; aceasta nu exclude suprasolicitarea sau regresiile.');
  const heading=document.createElement('h4');heading.textContent='Istoricul implicării';target.append(heading);
  p('Execuțiile care intersectează intervalul păstrează contextul complet. Comparațiile și regresiile folosesc numai execuții complete cuprinse integral în interval. Datele din afara intervalului sunt context, nu rezultate suplimentare.');
  const chronology=document.createElement('ol');chronology.dataset.acpmTimeline='';
  const labels:Record<string,string>={STARTED:'Pornire',WORKING:'Intervenție',SUSPENDED:'Suspendare',RESUMED:'Reluare',BLOCKED:'Blocaj',HANDOFF:'Transfer',COMPLETED:'Finalizare',FAILED:'Eșec explicit'};
  for(const e of snapshot.runs.flatMap(r=>r.events).sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence)) {
    const li=document.createElement('li');li.textContent=`${e.occurredAt} · ${e.componentId} · ${labels[e.kind]??e.kind} · mandat ${e.mandateId} · ${e.eventId} · ${e.evidenceRef}`;chronology.append(li);
  }
  target.append(chronology);
  const evolution=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Evoluția execuțiilor observate';evolution.append(summary);
  for(const run of [...snapshot.runs].sort((a,b)=>Date.parse(a.events[0].occurredAt)-Date.parse(b.events[0].occurredAt))) {
    const item=document.createElement('p');item.textContent=`${run.events.at(-1)!.occurredAt} · ${run.componentId} · ${run.runId} · ${run.status} · activ ${duration(run.activeMs)} · ${run.complete?'interval complet verificabil':'acoperire incompletă'} · ${run.events.at(-1)!.eventId}`;evolution.append(item);
  }
  if(!snapshot.runs.length){const item=document.createElement('p');item.textContent='Istoric și evoluție indisponibile pentru selecția curentă.';evolution.append(item);}
  target.append(evolution);
}
export function bindAcpm(root: HTMLElement, fetcher: typeof fetch = authenticatedApiFetch as typeof fetch) {
  const button=root.querySelector<HTMLButtonElement>('[data-acpm-refresh]');
  const status=root.querySelector<HTMLElement>('[data-acpm-status]');
  const target=root.querySelector<HTMLElement>('[data-acpm-content]');
  if(!button || !status || !target || button.dataset.bound) return;
  button.dataset.bound='1';
  let generation=0;
  let snapshot:AcpmSnapshot|null=null;
  const component=root.querySelector<HTMLSelectElement>('[data-acpm-component]')!;
  const kind=root.querySelector<HTMLSelectElement>('[data-acpm-kind]')!;
  const department=root.querySelector<HTMLSelectElement>('[data-acpm-department]')!;
  const from=root.querySelector<HTMLInputElement>('[data-acpm-from]')!;
  const to=root.querySelector<HTMLInputElement>('[data-acpm-to]')!;
  const populate=(select:HTMLSelectElement,values:string[])=>{const previous=select.value;while(select.options.length>1)select.remove(1);for(const value of [...new Set(values)].sort()){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}select.value=values.includes(previous)?previous:'';};
  const apply=()=>{
    target.replaceChildren();
    if(!snapshot){status.textContent='Date indisponibile. Folosește Actualizează ACPM pentru o citire autorizată.';return;}
    try {
      const filters:AcpmFilters={componentId:component.value||undefined,kind:kind.value||undefined,departmentId:department.value||undefined,from:from.value?new Date(from.value).toISOString():undefined,to:to.value?new Date(to.value).toISOString():undefined};
      const selection=selectAcpm(snapshot,filters);renderAcpm(target,selection);
      status.textContent=`Citire reușită · ${selection.runs.length}/${snapshot.runs.length} execuții în selecție · sursă observată la ${snapshot.observedAt}.`;
    }catch {target.replaceChildren();status.textContent='Interval temporal sau date invalide. Niciun rezultat afișat.';}
  };
  root.querySelector('[data-acpm-apply]')!.addEventListener('click',apply);
  root.querySelector('[data-acpm-reset]')!.addEventListener('click',()=>{component.value='';kind.value='';department.value='';from.value='';to.value='';apply();});
  button.addEventListener('click',async()=>{
    const request=++generation; button.disabled=true; snapshot=null;target.replaceChildren();status.textContent='Se citesc evenimentele…';
    try {
      const response=await fetcher('/acpm',{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
      if(response.status===401) throw new Error('Sesiunea contului AGM lipsește sau a expirat. Autentifică-te în contul OWNER; PIN-ul TURN nu o înlocuiește');
      if(response.status===403) throw new Error('Contul autentificat nu are acces OWNER la ACPM. Rolurile existente rămân obligatorii');
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      if(payload.data?.contract!=='agent-chain-performance-monitor.v1' || !Array.isArray(payload.data.runs)) throw new Error('Contract ACPM invalid');
      if(request!==generation || !root.isConnected) return;
      snapshot=payload.data;
      populate(component,[...snapshot!.runs.map(r=>r.componentId),...(snapshot!.inventory??[]).map(n=>n.componentId)]);
      populate(kind,[...snapshot!.runs.map(r=>r.componentKind),...(snapshot!.inventory??[]).map(n=>n.kind),'AGENT','ORCHESTRATOR','INSPECTOR','DEPARTMENT']);
      populate(department,[...snapshot!.departments.map(d=>d.id),...(snapshot!.inventory??[]).filter(n=>n.kind==='DEPARTMENT').map(n=>n.componentId)]);
      apply();
    } catch(error) { if(request===generation) { snapshot=null;target.replaceChildren();status.textContent=`ACPM indisponibil: ${error instanceof Error ? error.message : 'eroare de citire'}. Niciun rezultat anterior nu este prezentat ca actual.`; } }
    finally { if(request===generation) button.disabled=false; }
  });
}
