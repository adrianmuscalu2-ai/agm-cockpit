export type PremiumViewName =
  | 'premium'
  | 'premiumNetwork'
  | 'premiumCopilot'
  | 'premiumTeam'
  | 'premiumLoadSafety'
  | 'premiumCommunications'
  | 'premiumVoice'
  | 'carMover'
  | 'carMoverMenu'
  | 'carMoverPlanning'
  | 'carMoverActive'
  | 'carMoverCompletion'
  | 'carMoverAccounting'
  | 'carMoverGuide'
  | 'carMoverArchive';

type PremiumRouteDefinition = {
  view: PremiumViewName;
  route: `/${string}`;
};

export const PRE_001_SHELL_CONTRACT = {
  id: 'PRE-001',
  owns: ['premium-route-registry', 'premium-layout', 'premium-view-dispatch'],
  excludes: ['trip-lifecycle', 'ai-decisions', 'load-safety-domain-logic'],
} as const;

export const premiumRouteRegistry: readonly PremiumRouteDefinition[] = [
  { view: 'premium', route: '/premium' },
  { view: 'premiumNetwork', route: '/premium/network' },
  { view: 'premiumCopilot', route: '/premium/copilot' },
  { view: 'premiumTeam', route: '/premium/team' },
  { view: 'premiumLoadSafety', route: '/premium/ladungssicherung' },
  { view: 'premiumCommunications', route: '/premium/communications' },
  { view: 'premiumVoice', route: '/premium/voice' },
  { view: 'carMover', route: '/car-mover' },
  { view: 'carMoverMenu', route: '/car-mover/menu' },
  { view: 'carMoverPlanning', route: '/car-mover/planning' },
  { view: 'carMoverActive', route: '/car-mover/active-transfer' },
  { view: 'carMoverCompletion', route: '/car-mover/completion-incidents' },
  { view: 'carMoverAccounting', route: '/car-mover/accounting' },
  { view: 'carMoverGuide', route: '/car-mover/guide' },
  { view: 'carMoverArchive', route: '/car-mover/archive' },
];

export function premiumViewFromRoute(route: string): PremiumViewName | undefined {
  const normalizedRoute = normalizePremiumRoute(route);
  return premiumRouteRegistry.find((entry) => entry.route === normalizedRoute)?.view;
}

export function premiumRouteForView(view: string): string | undefined {
  return premiumRouteRegistry.find((entry) => entry.view === view)?.route;
}

export function isPremiumView(view: string | undefined): view is PremiumViewName {
  return premiumRouteRegistry.some((entry) => entry.view === view);
}

export function normalizePremiumRoute(route: string): string {
  const withoutQueryOrFragment = route.trim().split(/[?#]/, 1)[0];
  const withLeadingSlash = `/${withoutQueryOrFragment.replace(/^\/+/, '')}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
}
