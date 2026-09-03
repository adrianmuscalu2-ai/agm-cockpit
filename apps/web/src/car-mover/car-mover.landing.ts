import type { BasicLanguageCode } from '../language-registry';

const copy = {
  ro: { eyebrow:'Rută operațională AGM Premium', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Planifică, compară și asistă executarea mutării vehiculelor pe baza datelor reale AGM.', action:'Intră în Car Mover', back:'Înapoi la Premium', copilot:'AGM Premium Copilot', ocr:'Cameră OCR', voice:'Vorbește', boundary:'Decizia finală rămâne umană.', flow:'HERO → Module → Human Decide → Job File' },
  en: { eyebrow:'AGM Premium operational route', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Plan, compare and execute vehicle movements using real AGM data.', action:'Enter Car Mover', back:'Back to Premium', copilot:'AGM Premium Copilot', ocr:'Camera OCR', voice:'Speak', boundary:'The final decision remains human.', flow:'HERO → Modules → Human Decide → Job File' },
  de: { eyebrow:'Operative Route in AGM Premium', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Fahrzeugbewegungen mit realen AGM-Daten planen, vergleichen und ausführen.', action:'Car Mover öffnen', back:'Zurück zu Premium', copilot:'AGM Premium Copilot', ocr:'Kamera OCR', voice:'Sprechen', boundary:'Die endgültige Entscheidung bleibt menschlich.', flow:'HERO → Module → Human Decide → Job File' },
  it: { eyebrow:'Percorso operativo AGM Premium', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Pianifica, confronta ed esegui gli spostamenti dei veicoli usando dati AGM reali.', action:'Apri Car Mover', back:'Torna a Premium', copilot:'AGM Premium Copilot', ocr:'Fotocamera OCR', voice:'Parla', boundary:'La decisione finale resta umana.', flow:'HERO → Moduli → Decisione umana → Scheda incarico' },
  es: { eyebrow:'Ruta operativa AGM Premium', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Planifica, compara y ejecuta movimientos de vehículos con datos reales de AGM.', action:'Abrir Car Mover', back:'Volver a Premium', copilot:'AGM Premium Copilot', ocr:'Cámara OCR', voice:'Hablar', boundary:'La decisión final sigue siendo humana.', flow:'HERO → Módulos → Decisión humana → Expediente' },
  sv: { eyebrow:'Operativ rutt i AGM Premium', title:'CAR MOVER', accent:'DISPATCH AI', subtitle:'Planera, jämför och utför fordonsförflyttningar med verkliga AGM-data.', action:'Öppna Car Mover', back:'Tillbaka till Premium', copilot:'AGM Premium Copilot', ocr:'OCR-kamera', voice:'Tala', boundary:'Det slutliga beslutet är alltid mänskligt.', flow:'HERO → Moduler → Mänskligt beslut → Uppdragsakt' },
} as const;

export function renderCarMoverLanding(language: BasicLanguageCode) {
  const text = language === 'it' || language === 'es' || language === 'sv'
    ? copy[language]
    : language === 'ro'
      ? copy.ro
      : language === 'de'
        ? copy.de
        : copy.en;
  return `<section class="car-mover-entry" aria-labelledby="car-mover-entry-title">
    <img class="car-mover-entry-image" src="/images/car-mover-route-entry-bg-v4.png" alt="" aria-hidden="true">
    <div class="car-mover-entry-shade" aria-hidden="true"></div>
    <header class="car-mover-entry-topline">
      <strong><span>AGM</span> PREMIUM</strong>
      <a class="car-mover-entry-back" href="/premium" data-module="premium">${text.back}</a>
    </header>
    <div class="car-mover-entry-layout">
      <article class="car-mover-entry-panel">
        <div class="car-mover-entry-copy">
          <small>${text.eyebrow}</small>
          <h1 id="car-mover-entry-title">${text.title} <span>/ ${text.accent}</span></h1>
          <p>${text.subtitle}</p>
        </div>
        <p class="car-mover-entry-boundary"><span aria-hidden="true"></span>${text.boundary}</p>
        <div class="car-mover-entry-actions">
          <a class="car-mover-entry-action" href="/car-mover/menu" data-module="carMoverMenu">${text.action}</a>
          <div class="car-mover-entry-controls">
            <a href="/premium/copilot" data-module="premiumCopilot">${text.copilot}</a>
            <a href="/ocr" data-module="ocr">${text.ocr}</a>
            <a href="/premium/voice" data-module="premiumVoice">${text.voice}</a>
          </div>
        </div>
        <p class="car-mover-entry-flow">${text.flow}</p>
      </article>
    </div>
  </section>`;
}
