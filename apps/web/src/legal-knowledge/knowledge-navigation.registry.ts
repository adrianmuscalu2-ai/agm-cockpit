import type { KnowledgePackage } from './knowledge.contract';

export const basicKnowledgeDestinations = [
  { id: 'legislation', route: '/knowledge/legislatie', title: 'Legislație', packageIds: ['KB-LEGAL-DRT-001', 'KB-LEGAL-TRANSPORT-DOCS-001'] },
  { id: 'tachograph', route: '/knowledge/tahograf', title: 'Tahograf', packageIds: ['KB-LEGAL-TACH-001'] },
  { id: 'dashboard-warnings', route: '/knowledge/martori-bord', title: 'Martori în bord', packageIds: ['KB-VEHICLE-WARN-001'] },
  { id: 'cargo-securing', route: '/knowledge/ancorarea-marfii', title: 'Ancorarea mărfii', packageIds: ['KB-LEGAL-CARGO-SECURING-001'] },
] as const;

export type BasicKnowledgeDestination = (typeof basicKnowledgeDestinations)[number];

export function basicKnowledgeDestinationFromRoute(route: string): BasicKnowledgeDestination | undefined {
  const normalized = `/${route.replace(/^\/?/, '').toLocaleLowerCase()}`;
  return basicKnowledgeDestinations.find((destination) => destination.route === normalized);
}

export function packagesForBasicKnowledgeDestination(
  destination: BasicKnowledgeDestination,
  publishedPackages: readonly KnowledgePackage[],
): readonly KnowledgePackage[] {
  const allowedIds = new Set<string>(destination.packageIds);
  return publishedPackages.filter((knowledgePackage) => allowedIds.has(knowledgePackage.id));
}
