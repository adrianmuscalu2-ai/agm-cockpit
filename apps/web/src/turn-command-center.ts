export type TurnHealthStatus = 'active' | 'stable' | 'planned' | 'watch';

export type TurnCommandItem = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  status: TurnHealthStatus;
};

export type TurnMissionItem = {
  id: string;
  titleKey: string;
  status: TurnHealthStatus;
  validationKey: string;
};

export const turnDepartments: TurnCommandItem[] = [
  { id: 'turn-command', titleKey: 'turn.department.turnCommand', descriptionKey: 'turn.department.turnCommandDesc', status: 'active' },
  { id: 'product-roadmap', titleKey: 'turn.department.productRoadmap', descriptionKey: 'turn.department.productRoadmapDesc', status: 'planned' },
  { id: 'architecture-platform', titleKey: 'turn.department.architecture', descriptionKey: 'turn.department.architectureDesc', status: 'active' },
  { id: 'frontend-experience', titleKey: 'turn.department.frontend', descriptionKey: 'turn.department.frontendDesc', status: 'active' },
  { id: 'backend-infrastructure', titleKey: 'turn.department.backend', descriptionKey: 'turn.department.backendDesc', status: 'stable' },
  { id: 'ai-agents', titleKey: 'turn.department.aiAgents', descriptionKey: 'turn.department.aiAgentsDesc', status: 'watch' },
  { id: 'qa-validation', titleKey: 'turn.department.qa', descriptionKey: 'turn.department.qaDesc', status: 'active' },
  { id: 'security-legal', titleKey: 'turn.department.securityLegal', descriptionKey: 'turn.department.securityLegalDesc', status: 'active' },
  { id: 'release-operations', titleKey: 'turn.department.releaseOps', descriptionKey: 'turn.department.releaseOpsDesc', status: 'planned' },
  { id: 'documentation-knowledge', titleKey: 'turn.department.documentation', descriptionKey: 'turn.department.documentationDesc', status: 'active' },
];

export const turnAgents: TurnCommandItem[] = [
  { id: 'architecture', titleKey: 'turn.agent.architecture', descriptionKey: 'turn.agent.architectureDesc', status: 'active' },
  { id: 'qa-testing', titleKey: 'turn.agent.qa', descriptionKey: 'turn.agent.qaDesc', status: 'active' },
  { id: 'ui-ux', titleKey: 'turn.agent.uiux', descriptionKey: 'turn.agent.uiuxDesc', status: 'active' },
  { id: 'i18n', titleKey: 'turn.agent.i18n', descriptionKey: 'turn.agent.i18nDesc', status: 'active' },
  { id: 'security', titleKey: 'turn.agent.security', descriptionKey: 'turn.agent.securityDesc', status: 'active' },
  { id: 'legal', titleKey: 'turn.agent.legal', descriptionKey: 'turn.agent.legalDesc', status: 'stable' },
  { id: 'integration', titleKey: 'turn.agent.integration', descriptionKey: 'turn.agent.integrationDesc', status: 'active' },
  { id: 'documentation', titleKey: 'turn.agent.documentation', descriptionKey: 'turn.agent.documentationDesc', status: 'active' },
  { id: 'ai-governance', titleKey: 'turn.agent.aiGovernance', descriptionKey: 'turn.agent.aiGovernanceDesc', status: 'planned' },
  { id: 'release', titleKey: 'turn.agent.release', descriptionKey: 'turn.agent.releaseDesc', status: 'planned' },
];

export const turnModules: TurnCommandItem[] = [
  { id: 'translator', titleKey: 'turn.module.translator', descriptionKey: 'turn.module.translatorDesc', status: 'stable' },
  { id: 'profile', titleKey: 'turn.module.profile', descriptionKey: 'turn.module.profileDesc', status: 'stable' },
  { id: 'mailmaster', titleKey: 'turn.module.mailmaster', descriptionKey: 'turn.module.mailmasterDesc', status: 'stable' },
  { id: 'text-corrector', titleKey: 'turn.module.textCorrector', descriptionKey: 'turn.module.textCorrectorDesc', status: 'active' },
  { id: 'legal', titleKey: 'turn.module.legal', descriptionKey: 'turn.module.legalDesc', status: 'stable' },
  { id: 'contact-manager', titleKey: 'turn.module.contactManager', descriptionKey: 'turn.module.contactManagerDesc', status: 'active' },
  { id: 'android-pwa', titleKey: 'turn.module.androidPwa', descriptionKey: 'turn.module.androidPwaDesc', status: 'watch' },
  { id: 'turn-command-center', titleKey: 'turn.module.turnCenter', descriptionKey: 'turn.module.turnCenterDesc', status: 'active' },
];

export const turnMissions: TurnMissionItem[] = [
  { id: 'AG-012', titleKey: 'turn.mission.legal', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-013', titleKey: 'turn.mission.language', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-014', titleKey: 'turn.mission.ux', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-015', titleKey: 'turn.mission.architectureAudit', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-016', titleKey: 'turn.mission.strategyAudit', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-017', titleKey: 'turn.mission.turnMvp', status: 'active', validationKey: 'turn.validation.inProgress' },
];

export const turnAuditTrail: TurnMissionItem[] = [
  { id: 'AG-012.1', titleKey: 'turn.audit.technicalInventory', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-012.2', titleKey: 'turn.audit.legalAudit', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-012.3', titleKey: 'turn.audit.legalImplementation', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-013.1', titleKey: 'turn.audit.localizationFixes', status: 'stable', validationKey: 'turn.validation.accepted' },
  { id: 'AG-014.1', titleKey: 'turn.audit.uxFixes', status: 'stable', validationKey: 'turn.validation.accepted' },
];
