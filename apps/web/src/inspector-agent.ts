export type InspectorStatus = 'ok' | 'attention' | 'error';
export type InspectorTrend = 'stable' | 'improving' | 'watch';

export type InspectorReport = {
  id: string;
  ownerId: string;
  status: InspectorStatus;
  lastCheckedAt: string;
  trend: InspectorTrend;
  summaryKey: string;
  issuesKey: string;
  recommendationsKey: string;
};

export const inspectorReports: InspectorReport[] = [
  {
    id: 'inspector-turn-command',
    ownerId: 'turn-command',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.turnCommand.summary',
    issuesKey: 'inspector.report.turnCommand.issues',
    recommendationsKey: 'inspector.report.turnCommand.recommendations',
  },
  {
    id: 'inspector-product-roadmap',
    ownerId: 'product-roadmap',
    status: 'attention',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'watch',
    summaryKey: 'inspector.report.productRoadmap.summary',
    issuesKey: 'inspector.report.productRoadmap.issues',
    recommendationsKey: 'inspector.report.productRoadmap.recommendations',
  },
  {
    id: 'inspector-architecture-platform',
    ownerId: 'architecture-platform',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.architecture.summary',
    issuesKey: 'inspector.report.architecture.issues',
    recommendationsKey: 'inspector.report.architecture.recommendations',
  },
  {
    id: 'inspector-frontend-experience',
    ownerId: 'frontend-experience',
    status: 'attention',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'watch',
    summaryKey: 'inspector.report.frontend.summary',
    issuesKey: 'inspector.report.frontend.issues',
    recommendationsKey: 'inspector.report.frontend.recommendations',
  },
  {
    id: 'inspector-backend-infrastructure',
    ownerId: 'backend-infrastructure',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.backend.summary',
    issuesKey: 'inspector.report.backend.issues',
    recommendationsKey: 'inspector.report.backend.recommendations',
  },
  {
    id: 'inspector-ai-agents',
    ownerId: 'ai-agents',
    status: 'attention',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'watch',
    summaryKey: 'inspector.report.aiAgents.summary',
    issuesKey: 'inspector.report.aiAgents.issues',
    recommendationsKey: 'inspector.report.aiAgents.recommendations',
  },
  {
    id: 'inspector-qa-validation',
    ownerId: 'qa-validation',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.qa.summary',
    issuesKey: 'inspector.report.qa.issues',
    recommendationsKey: 'inspector.report.qa.recommendations',
  },
  {
    id: 'inspector-security-legal',
    ownerId: 'security-legal',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.securityLegal.summary',
    issuesKey: 'inspector.report.securityLegal.issues',
    recommendationsKey: 'inspector.report.securityLegal.recommendations',
  },
  {
    id: 'inspector-release-operations',
    ownerId: 'release-operations',
    status: 'attention',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'watch',
    summaryKey: 'inspector.report.releaseOps.summary',
    issuesKey: 'inspector.report.releaseOps.issues',
    recommendationsKey: 'inspector.report.releaseOps.recommendations',
  },
  {
    id: 'inspector-documentation-knowledge',
    ownerId: 'documentation-knowledge',
    status: 'ok',
    lastCheckedAt: '2026-07-13T20:00:00Z',
    trend: 'stable',
    summaryKey: 'inspector.report.documentation.summary',
    issuesKey: 'inspector.report.documentation.issues',
    recommendationsKey: 'inspector.report.documentation.recommendations',
  },
];

export function inspectorReportFor(ownerId: string) {
  return inspectorReports.find((report) => report.ownerId === ownerId);
}
