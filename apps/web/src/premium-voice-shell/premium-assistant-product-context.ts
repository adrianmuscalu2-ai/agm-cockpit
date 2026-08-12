export const activePremiumAssistantProductIds = ['agm-cockpit'] as const;
export const reservedFuturePremiumAssistantProductIds = ['agm-car-mover'] as const;

export type ActivePremiumAssistantProductId = (typeof activePremiumAssistantProductIds)[number];

export type PremiumAssistantProductScope = {
  productId: ActivePremiumAssistantProductId;
  moduleId: string;
  tenantId: string;
  subjectId: string;
  requiredEntitlement: 'premium.voice-assistant';
};

export type PremiumAssistantOperationalContext = {
  tripId?: string;
  operationalCaseId?: string;
  situationId?: string;
};

export type PremiumAssistantProductContextAdapter<TContext extends PremiumAssistantOperationalContext> = {
  productId: ActivePremiumAssistantProductId;
  projectContext: (context: TContext) => readonly string[];
  allowsAction: (moduleId: string, capability: string) => boolean;
};

export const agmCockpitVoiceContextAdapter: PremiumAssistantProductContextAdapter<PremiumAssistantOperationalContext> = {
  productId: 'agm-cockpit',
  projectContext: (context) => [
    context.tripId && `trip:${context.tripId}`,
    context.operationalCaseId && `case:${context.operationalCaseId}`,
    context.situationId && `situation:${context.situationId}`,
  ].filter((value): value is string => Boolean(value)),
  allowsAction: (moduleId, capability) => moduleId.trim().length > 0 && capability.trim().length > 0,
};

export function samePremiumAssistantProductScope(left: PremiumAssistantProductScope, right: PremiumAssistantProductScope) {
  return left.productId === right.productId
    && left.moduleId === right.moduleId
    && left.tenantId === right.tenantId
    && left.subjectId === right.subjectId
    && left.requiredEntitlement === right.requiredEntitlement;
}

