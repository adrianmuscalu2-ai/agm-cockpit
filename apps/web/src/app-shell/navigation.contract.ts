import type { AppViewName } from './app-state.contract';

export const APP_SHELL_NAVIGATION_CONTRACT = {
  id: 'APP-001',
  version: 'app-shell-navigation.v1',
  fallbackView: 'home',
  lifecycleEvents: ['initial-render', 'navigate', 'popstate', 'hashchange'] as const,
} as const;

type ShellRouteDefinition = {
  view: Exclude<AppViewName, 'premium' | 'premiumTeam' | 'premiumLoadSafety'>;
  canonicalRoute: `/${string}` | '/';
  aliases: readonly string[];
};

export const shellRouteRegistry: readonly ShellRouteDefinition[] = [
  { view: 'home', canonicalRoute: '/', aliases: ['', 'home'] },
  { view: 'cockpit', canonicalRoute: '/translator', aliases: ['cockpit', 'translator', 'traducator'] },
  { view: 'email', canonicalRoute: '/email', aliases: ['email', 'email-assistant', 'ag-011-009'] },
  { view: 'profile', canonicalRoute: '/profile', aliases: ['profile', 'profil', 'ag-011-010'] },
  { view: 'corrector', canonicalRoute: '/corrector', aliases: ['corrector', 'text-corrector', 'ag-011-011'] },
  { view: 'turn', canonicalRoute: '/turn', aliases: ['turn', 'turn-command-center', 'command-center', 'ag-017'] },
  { view: 'legal', canonicalRoute: '/legal', aliases: ['legal', 'terms', 'privacy', 'compliance'] },
  { view: 'about', canonicalRoute: '/about', aliases: ['about', 'despre'] },
  { view: 'roadmap', canonicalRoute: '/roadmap', aliases: ['roadmap', 'foaie-de-parcurs'] },
  { view: 'licenses', canonicalRoute: '/licenses', aliases: ['licenses', 'open-source', 'third-party-notices'] },
];

export function shellViewFromRoute(route: string): ShellRouteDefinition['view'] | undefined {
  const normalized = route.replace(/^\/?/, '').toLocaleLowerCase();
  return shellRouteRegistry.find((entry) => entry.aliases.includes(normalized))?.view;
}

export function routeForShellView(view: AppViewName): string | undefined {
  return shellRouteRegistry.find((entry) => entry.view === view)?.canonicalRoute;
}

export function isTurnSectionFragment(fragment: string) {
  const normalized = fragment.toLocaleLowerCase();
  return normalized.startsWith('turn-') || normalized === 'incident-journal';
}

