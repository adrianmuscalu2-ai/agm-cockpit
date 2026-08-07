export const appViewModuleRegistry = [
  { id: 'home', view: 'home', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'basic', view: 'basic', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'ocr', view: 'ocr', owner: 'ocr', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'access', view: 'access', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'premium', view: 'premium', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'premium-team', view: 'premiumTeam', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'premium-load-safety', view: 'premiumLoadSafety', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'cockpit', view: 'cockpit', owner: 'translator', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'email', view: 'email', owner: 'mail', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'profile', view: 'profile', owner: 'profile', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'corrector', view: 'corrector', owner: 'corrector', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'turn', view: 'turn', owner: 'admin', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'legal', view: 'legal', owner: 'guidance', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'about', view: 'about', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'roadmap', view: 'roadmap', owner: 'guidance', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
  { id: 'licenses', view: 'licenses', owner: 'shell', activation: 'legacy-main', lifecycle: ['render', 'bind'] },
] as const satisfies readonly import('./view-module.contract').ViewModuleRegistration[];

export const appEntrypointRegistry = [
  { id: 'main', html: 'index.html', activation: 'legacy-main' },
  { id: 'beforeDeparture', html: 'before-departure.html', activation: 'external-entrypoint' },
  { id: 'afterDeparture', html: 'after-departure.html', activation: 'external-entrypoint' },
] as const satisfies readonly import('./view-module.contract').AppEntrypointRegistration[];
