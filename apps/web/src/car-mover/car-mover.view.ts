import type { BasicLanguageCode } from '../language-registry';
import { carMoverText as x } from './car-mover.i18n';

export type CarMoverSection = 'planning' | 'active' | 'completion' | 'accounting' | 'guide' | 'archive';

const menuItems: ReadonlyArray<{
  section: CarMoverSection;
  module: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  { section:'planning', module:'carMoverPlanning', href:'/car-mover/planning', eyebrow:'01 · PLAN', title:'Planning / Opportunity Intelligence', description:'Intake live, deduplicare, Cost & Risk, Judge, Copilot și decizie umană.' },
  { section:'active', module:'carMoverActive', href:'/car-mover/active-transfer', eyebrow:'02 · EXECUTE', title:'Active Transfer', description:'Job File, preluare, cursă activă, sosire și predare.' },
  { section:'completion', module:'carMoverCompletion', href:'/car-mover/completion-incidents', eyebrow:'03 · CLOSE', title:'Completion / Incidents', description:'Închidere PASS sau Incident File, fără blocarea automată a aplicației.' },
  { section:'accounting', module:'carMoverAccounting', href:'/car-mover/accounting', eyebrow:'04 · RECORD', title:'Post-Trip / Primary Accounting', description:'Venituri, costuri, plăți și facturi reale. ESTIMATED ≠ ACTUAL.' },
  { section:'guide', module:'carMoverGuide', href:'/car-mover/guide', eyebrow:'05 · KNOWLEDGE', title:'Car Mover Guide', description:'Ghid operațional și acces la AGM Knowledge validat.' },
  { section:'archive', module:'carMoverArchive', href:'/car-mover/archive', eyebrow:'06 · RETAIN', title:'Archive', description:'Istoric compact, surse, audit, dovezi și politica de retenție.' },
];

const vehicleClasses = [
  ['PASSENGER_CAR','passenger'], ['LIGHT_COMMERCIAL','commercial'], ['VAN','van'],
  ['TRUCK','truck'], ['TRACTOR_UNIT','tractor'], ['OTHER_DRIVABLE_VEHICLE','other'],
] as const;

function navigation(title: string, menu = false) {
  return `<header class="car-mover-module-header">
    <div><small>AGM PREMIUM · CAR MOVER</small><h1>${title}</h1></div>
    <nav aria-label="Navigare Car Mover">
      ${menu ? '' : '<a href="/car-mover/menu" data-module="carMoverMenu">Înapoi la meniu</a>'}
      <a href="/car-mover" data-module="carMover">HERO Car Mover</a>
      <a href="/ocr" data-module="ocr" data-car-mover-quick="ocr">Cameră OCR</a>
      <a href="/premium/voice" data-module="premiumVoice" data-car-mover-quick="voice">Vorbește</a>
    </nav>
  </header>`;
}

function statusAndDialog() {
  return `<p class="car-mover-runtime-status" role="status" data-car-mover-status></p>
    <dialog data-car-mover-dialog><button data-car-mover-close aria-label="Închide">×</button><div data-car-mover-file></div></dialog>`;
}

export function renderCarMoverMenu(_language: BasicLanguageCode) {
  return `<section class="car-mover car-mover-menu" aria-labelledby="car-mover-menu-title">
    ${navigation('Centru operațional', true)}
    <main>
      <div class="car-mover-menu-intro"><p>Alegeți etapa. Fiecare cale folosește datele și contractele reale AGM.</p><strong>Human decide · telemetry observes · manual fallback remains available</strong></div>
      <div class="car-mover-menu-grid" id="car-mover-menu-title">
        ${menuItems.map((item) => `<a class="car-mover-menu-card" data-section="${item.section}" href="${item.href}" data-module="${item.module}"><small>${item.eyebrow}</small><strong>${item.title}</strong><span>${item.description}</span><em>Deschide →</em></a>`).join('')}
      </div>
    </main>
  </section>`;
}

export function renderCarMoverModule(section: CarMoverSection, language: BasicLanguageCode) {
  if (section === 'guide') return renderGuide(language);
  const title = menuItems.find((item) => item.section === section)?.title ?? 'Car Mover';
  return `<section class="car-mover car-mover-module" data-car-mover-root data-car-mover-section="${section}" data-language="${language}">
    ${navigation(title)}
    ${renderSection(section, language)}
    ${statusAndDialog()}
  </section>`;
}

function renderSection(section: Exclude<CarMoverSection, 'guide'>, language: BasicLanguageCode) {
  if (section === 'planning') return renderPlanning();
  if (section === 'active') return renderActive(language);
  if (section === 'completion') return renderCompletion();
  if (section === 'accounting') return renderAccounting();
  return renderArchive();
}

function renderPlanning() {
  return `<main>
    <section class="car-mover-offers"><div class="car-mover-section-title"><div><small>PLATFORM INTAKE & DEDUPLICATION</small><h2>Oferte live</h2><p>Gmail și canalele aprobate · normalizare controlată · fără acceptare automată</p><p data-car-mover-provider-status>Starea furnizorilor se verifică…</p></div><button type="button" data-car-mover-analyze>Sincronizează și analizează</button></div><div data-car-mover-offers>Se încarcă ofertele normalizate…</div></section>
    <section class="car-mover-planning" aria-labelledby="opportunity-planning-title"><div class="car-mover-section-title"><div><small>OPPORTUNITY INTELLIGENCE</small><h2 id="opportunity-planning-title">Planning · Cost & Risk · Judge</h2><p data-opportunity-copilot>Se încarcă recomandarea Copilot…</p></div><button type="button" data-opportunity-refresh>Actualizează</button></div><div data-opportunity-planning>Se încarcă variantele…</div><p class="car-mover-planning-policy">Rezultatele sunt user-facing. Nicio cursă nu este acceptată automat; Job File apare numai după decizia umană explicită.</p></section>
  </main>`;
}

function renderActive(language: BasicLanguageCode) {
  return `<main>
    <div class="car-mover-policy-strip"><strong>Lifecycle:</strong> ACCEPTED → PICKUP protocol → IN_PROGRESS → ARRIVED → HANDOVER → COMPLETED <span>OCR / Camera: numai pentru excepții și dovezi.</span></div>
    <div class="car-mover-grid">
      <form data-car-mover-create><h2>${x(language,'newJob')}</h2><p>Fluxul manual rămâne disponibil independent de providerii externi.</p><label>${x(language,'vehicleClass')}<select name="vehicleClass" required><option value="">${x(language,'select')}</option>${vehicleClasses.map(([value,key])=>`<option value="${value}">${x(language,key)}</option>`).join('')}</select></label><label>${x(language,'vehicleType')}<input name="vehicleType" required maxlength="80"></label><div class="car-mover-pair"><label>${x(language,'make')}<input name="make" maxlength="120"></label><label>${x(language,'model')}<input name="model" maxlength="120"></label></div><div class="car-mover-pair"><label>${x(language,'vin')}<input name="vin" maxlength="32"></label><label>${x(language,'registration')}<input name="registration" maxlength="32"></label></div><label>${x(language,'pickup')}<input name="pickup" required maxlength="240"></label><label>${x(language,'destination')}<input name="destination" required maxlength="240"></label><button class="primary" type="submit">${x(language,'create')}</button></form>
      <section><div class="car-mover-section-title"><div><h2>Transferuri active</h2><p>Deschideți Job File pentru preluare, progres, predare și comunicare.</p></div><button data-car-mover-refresh>Actualizează</button></div><div data-car-mover-list>Se încarcă…</div><a class="car-mover-inline-action" href="/ocr" data-module="ocr">Camera / OCR pentru excepții</a></section>
    </div>
  </main>`;
}

function renderCompletion() {
  return `<main>
    <div class="car-mover-policy-strip"><strong>Reguli:</strong> INCIDENT ≠ HOLD ≠ CANCELLATION <span>OPEN INCIDENT ≠ BLOCKED APPLICATION</span></div>
    <div class="car-mover-grid">
      <section><div class="car-mover-section-title"><div><h2>Sosire și închidere</h2><p>Deschideți Job File pentru protocolul de predare și tranziția finală PASS.</p></div><button data-car-mover-refresh>Actualizează</button></div><div data-car-mover-list>Se încarcă…</div></section>
      <section><h2>Incident File</h2><p>Incidentul documentează situația tehnică; nu comandă și nu blochează aplicația.</p><form data-car-mover-incident><label>Cursa<select name="transportJobId" data-car-mover-incident-job required><option value="">Selectați cursa</option></select></label><label>Tip incident<input name="incidentType" required maxlength="80"></label><label>Severitate<select name="severity"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label>Titlu<input name="title" required maxlength="160"></label><label>Descriere<textarea name="description" maxlength="1000"></textarea></label><button type="submit">Creează Incident File</button></form><div data-car-mover-incidents>Se încarcă incidentele…</div></section>
    </div>
  </main>`;
}

function renderAccounting() {
  return `<main>
    <div class="car-mover-policy-strip"><strong>POST-TRIP:</strong> numai valori efectiv realizate și documente reale <span>ESTIMATED ≠ ACTUAL</span></div>
    <section class="car-mover-panel"><div class="car-mover-section-title"><div><h2>Primary Accounting</h2><p>Deschideți cursa pentru venituri, costuri, plăți și facturi.</p></div><button data-car-mover-refresh>Actualizează</button></div><div data-car-mover-list>Se încarcă…</div></section>
  </main>`;
}

function renderGuide(_language: BasicLanguageCode) {
  return `<section class="car-mover car-mover-module car-mover-guide" data-car-mover-section="guide" aria-labelledby="car-mover-guide-title">
    ${navigation('Car Mover Guide')}
    <main id="car-mover-guide-title">
      <div class="car-mover-guide-grid">
        <article><small>BEFORE ACCEPT</small><h2>Planning</h2><ol><li>Verificați sursa și freshness.</li><li>Comparați ruta, costul și riscul.</li><li>Decizia rămâne umană.</li></ol></article>
        <article><small>ON PICKUP</small><h2>Preluare</h2><ol><li>Confirmați vehiculul și cheile.</li><li>Notați kilometrajul și energia.</li><li>Folosiți Camera/OCR numai când există excepții.</li></ol></article>
        <article><small>ON ROUTE</small><h2>Transfer activ</h2><ol><li>Păstrați Job File actualizat.</li><li>Provider failure nu oprește fluxul manual.</li><li>Un incident deschis nu blochează aplicația.</li></ol></article>
        <article><small>AT HANDOVER</small><h2>Predare și arhivă</h2><ol><li>Înregistrați protocolul de predare.</li><li>Separați costurile estimate de cele reale.</li><li>Păstrați dovezile marcate PRESERVE.</li></ol></article>
      </div>
      <section class="car-mover-knowledge-links"><h2>AGM Knowledge</h2><p>Sursele validate existente rămân autoritatea pentru legislație, tahograf, martori de bord și siguranță.</p><div><a href="/knowledge/legislatie" data-module="legal">Legislație și documente</a><a href="/knowledge/tahograf" data-module="legal">Tahograf</a><a href="/knowledge/martori-bord" data-module="legal">Martori de bord</a><a href="/knowledge/ancorarea-marfii" data-module="legal">Siguranță</a></div></section>
    </main>
  </section>`;
}

function renderArchive() {
  return `<main>
    <div class="car-mover-policy-strip"><strong>RETENȚIE:</strong> media locală brută neesențială: 45 zile <span>Incident / claim / dispute: PRESERVE, fără ștergere automată.</span></div>
    <section class="car-mover-panel"><div class="car-mover-section-title"><div><h2>Istoric Car Mover</h2><p>Curse terminale, metadata, surse, cronologie, audit și dovezi.</p></div><button data-car-mover-refresh>Actualizează</button></div><div data-car-mover-list>Se încarcă…</div></section>
  </main>`;
}
