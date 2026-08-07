import { drivingRestTimesKnowledgePackage } from './driving-rest-times.package';
import { tachographKnowledgePackage } from './tachograph.package';
import { dashboardWarningLightsKnowledgePackage } from './dashboard-warning-lights.package';
import { transportDocumentsKnowledgePackage } from './transport-documents.package';
import { cargoSecuringKnowledgePackage } from './cargo-securing.package';
import { isKnowledgePackagePublishable, type KnowledgePackage } from './knowledge.contract';

export const legalKnowledgeRegistry: readonly KnowledgePackage[] = [
  drivingRestTimesKnowledgePackage,
  tachographKnowledgePackage,
  dashboardWarningLightsKnowledgePackage,
  transportDocumentsKnowledgePackage,
  cargoSecuringKnowledgePackage,
];

export function publishedLegalKnowledge(now = new Date()): readonly KnowledgePackage[] {
  return legalKnowledgeRegistry.filter((knowledgePackage) => isKnowledgePackagePublishable(knowledgePackage, now));
}
