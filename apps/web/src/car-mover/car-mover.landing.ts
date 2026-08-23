import type { BasicLanguageCode } from '../language-registry';

const copy = {
  ro: {
    eyebrow: 'Modul operațional inclus în AGM Premium',
    title: 'CAR MOVER',
    accent: 'DISPATCH AI',
    subtitle: 'Mutarea vehiculelor automatizată, filtrată și optimizată.',
    action: 'Intră în Car Mover',
    back: 'Înapoi la Premium',
  },
  en: {
    eyebrow: 'Operational module included in AGM Premium',
    title: 'CAR MOVER',
    accent: 'DISPATCH AI',
    subtitle: 'Automated, filtered and optimized vehicle movement.',
    action: 'Open Car Mover',
    back: 'Back to Premium',
  },
  de: {
    eyebrow: 'Betriebsmodul in AGM Premium enthalten',
    title: 'CAR MOVER',
    accent: 'DISPATCH AI',
    subtitle: 'Automatisierte, gefilterte und optimierte Fahrzeugbewegung.',
    action: 'Car Mover öffnen',
    back: 'Zurück zu Premium',
  },
} as const;

export function renderCarMoverLanding(language: BasicLanguageCode) {
  const text = language === 'ro' ? copy.ro : language === 'de' ? copy.de : copy.en;
  return `<section class="car-mover-entry" aria-labelledby="car-mover-entry-title">
    <img class="car-mover-entry-image" src="/images/car-mover-entry-hero-v2.png" alt="" aria-hidden="true">
    <div class="car-mover-entry-shade" aria-hidden="true"></div>
    <a class="car-mover-entry-back" href="/premium" data-module="premium">${text.back}</a>
    <div class="car-mover-entry-copy">
      <small>${text.eyebrow}</small>
      <h1 id="car-mover-entry-title">${text.title} <span>/ ${text.accent}</span></h1>
      <p>${text.subtitle}</p>
    </div>
    <a class="car-mover-entry-action" href="/car-mover/menu" data-module="carMoverMenu">${text.action}</a>
  </section>`;
}
