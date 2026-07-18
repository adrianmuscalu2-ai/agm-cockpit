export type PremiumViewName = 'premium' | 'premiumTeam';

type PremiumRouteDefinition = {
  view: PremiumViewName;
  route: `/${string}`;
};

export const premiumRouteRegistry: readonly PremiumRouteDefinition[] = [
  { view: 'premium', route: '/premium' },
  { view: 'premiumTeam', route: '/premium/team' },
];

export function premiumViewFromRoute(route: string): PremiumViewName | undefined {
  const normalizedRoute = `/${route.replace(/^\/+/, '')}`;
  return premiumRouteRegistry.find((entry) => entry.route === normalizedRoute)?.view;
}

export function premiumRouteForView(view: string): string | undefined {
  return premiumRouteRegistry.find((entry) => entry.view === view)?.route;
}

export function isPremiumView(view: string | undefined): view is PremiumViewName {
  return premiumRouteRegistry.some((entry) => entry.view === view);
}
