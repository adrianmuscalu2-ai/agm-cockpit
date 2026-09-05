const TURN_PAGES = ['basic', 'premium', 'incidents', 'investigate'] as const;
type TurnPage = (typeof TURN_PAGES)[number];

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
    if (updateLocation) history.replaceState(null, '', `${location.pathname}${location.search}#turn-${page}`);
    window.scrollTo({ top: root.offsetTop, behavior: 'smooth' });
  };

  root.querySelectorAll<HTMLButtonElement>('[data-turn-page-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.turnPageTarget;
      if (isTurnPage(page)) selectPage(page);
    });
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

  const initial = location.hash.startsWith('#turn-') ? location.hash.slice(6) : 'basic';
  selectPage(isTurnPage(initial) ? initial : 'basic', false);
}

function isTurnPage(value: string | undefined): value is TurnPage {
  return TURN_PAGES.includes(value as TurnPage);
}
