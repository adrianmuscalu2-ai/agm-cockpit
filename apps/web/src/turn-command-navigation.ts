import { turnModuleNavigationRegistry } from './turn-module-navigation.registry';
import type { GovernanceReadConnection, GovernanceReadModule } from './turn-agmatcc/agmatcc.commands';

const TURN_PAGES = ['agmatcc', 'basic', 'premium', 'orchestrators', 'incidents', 'investigate'] as const;
type TurnPage = (typeof TURN_PAGES)[number];
const TURN_LAST_PAGE_KEY = 'agm.turn.navigation.last-page.v1';

export function bindTurnCommandNavigation() {
  const root = document.querySelector<HTMLElement>('.turn-command-center');
  if (!root) return;

  const selectPage = (page: TurnPage, updateLocation = true) => {
    root.dataset.activeTurnPage = page;
    root.querySelectorAll<HTMLElement>('[data-turn-page]').forEach((section) => {
      section.hidden = section.dataset.turnPage !== page;
    });
    root.querySelectorAll<HTMLElement>('[data-turn-page-container]').forEach((container) => {
      container.hidden = !container.querySelector('[data-turn-page]:not([hidden])');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-turn-page-target]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.turnPageTarget === page));
    });
    try { window.localStorage.setItem(TURN_LAST_PAGE_KEY, page); } catch { /* optional non-sensitive preference */ }
    if (updateLocation) history.replaceState(null, '', `${location.pathname}${location.search}#turn-${page}`);
    window.scrollTo({ top: root.offsetTop, behavior: 'smooth' });
  };

  root.querySelectorAll<HTMLButtonElement>('[data-turn-page-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.turnPageTarget;
      if (isTurnPage(page)) selectPage(page);
    });
  });

  const moduleSearch = root.querySelector<HTMLInputElement>('[data-turn-module-search]');
  const moduleLinks = [...root.querySelectorAll<HTMLElement>('[data-turn-module-search-value]')];
  const empty = root.querySelector<HTMLElement>('[data-turn-module-search-empty]');
  moduleSearch?.addEventListener('input', () => {
    const query = moduleSearch.value.trim().toLocaleLowerCase();
    let visible = 0;
    moduleLinks.forEach((link) => {
      const match = !query || (link.dataset.turnModuleSearchValue ?? '').includes(query);
      link.hidden = !match;
      if (match) visible += 1;
    });
    root.querySelectorAll<HTMLElement>('.turn-module-nav-group').forEach((group) => {
      group.hidden = Boolean(query) && !group.querySelector('[data-turn-module-search-value]:not([hidden])');
    });
    if (empty) empty.hidden = visible > 0;
  });
  root.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-open-turn-page]');
    const page = trigger?.dataset.openTurnPage;
    if (!trigger || !isTurnPage(page)) return;
    event.preventDefault();
    selectPage(page);
    const href = trigger.getAttribute('href');
    if (href?.startsWith('#') && href.length > 1) requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(href);
      const disclosure = target?.closest<HTMLDetailsElement>('details');
      if (disclosure) disclosure.open = true;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    });
  });

  const backToTop = root.querySelector<HTMLButtonElement>('#turnBackToTop');
  const updateBackToTop = () => {
    if (backToTop) backToTop.hidden = window.scrollY < 480;
  };
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  updateBackToTop();

  // AGMaTCC is always the entry page; only an explicit #turn-<page> deep link overrides it.
  const module = turnModuleNavigationRegistry.find(entry => entry.target && `#${entry.target}` === location.hash);
  selectPage(resolveTurnInitialPage(location.hash), false);
  if (module?.target) requestAnimationFrame(() => document.getElementById(module.target!)?.scrollIntoView({ block: 'start' }));
}

export function resolveTurnInitialPage(hash: string): TurnPage {
  const initial = hash.startsWith('#turn-') ? hash.slice(6) : 'agmatcc';
  const module = turnModuleNavigationRegistry.find(entry => entry.target && `#${entry.target}` === hash);
  return isTurnPage(initial) ? initial : module?.page ?? 'agmatcc';
}

/** Session connectivity is separate from validation or activation authority. */
const readGenerations: Record<GovernanceReadModule, number> = { governance: 0, 'risk-knowledge': 0 };

export function beginTurnModuleRead(moduleId: GovernanceReadModule) {
  const generation = ++readGenerations[moduleId];
  updateTurnModuleReadState(moduleId, 'CHECKING', '', generation);
  return generation;
}

export function updateTurnModuleReadState(moduleId: GovernanceReadModule, state: GovernanceReadConnection, evidence = '', generation?: number) {
  if (generation !== undefined && generation !== readGenerations[moduleId]) return false;
  const labels: Record<GovernanceReadConnection, string> = {
    NOT_CHECKED: 'API: neverificat în această sesiune', CHECKING: 'API: se verifică…',
    CONNECTED_READ_ONLY: 'API conectat · citire autorizată', AUTH_REQUIRED: 'Autentificarea contului este necesară',
    FORBIDDEN: 'Acces refuzat · rol uman APPROVER/VALIDATOR necesar', UNAVAILABLE: 'API indisponibil · conexiune neconfirmată',
  };
  document.querySelectorAll<HTMLElement>(`[data-governance-connection="${moduleId}"]`).forEach(node => {
    node.textContent = labels[state]; node.dataset.connectionStatus = state; node.title = evidence;
  });
  document.querySelectorAll<HTMLElement>(`[data-turn-module-id="${moduleId}"], [data-turn-journal-row="${moduleId}"]`).forEach(node => {
    node.dataset.connectionStatus = state;
  });
  return true;
}

function isTurnPage(value: string | undefined): value is TurnPage {
  return TURN_PAGES.includes(value as TurnPage);
}
