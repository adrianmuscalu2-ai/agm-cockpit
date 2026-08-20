export type ExternalAccess = 'READ' | 'WRITE';
export type ExternalCapabilityId =
  | 'OPENAI_MODELS_READ'
  | 'SLACK_CHANNELS_READ'
  | 'SLACK_CHANNEL_HISTORY_READ'
  | 'GMAIL_MESSAGE_STATUS_READ'
  | 'GMAIL_COMPOSE_HANDOFF'
  | 'WHATSAPP_HANDOFF';
export type ExternalCapabilityRegistration = Readonly<{
  id: ExternalCapabilityId;
  provider: 'OPENAI' | 'SLACK' | 'GMAIL' | 'WHATSAPP';
  access: ExternalAccess;
  scopes: readonly string[];
  requiredEntitlement: 'premium.voice-assistant';
  state: 'ENABLED' | 'DISABLED';
  confirmationRequired: boolean;
  allowedActions: readonly string[];
  allowedDomains: readonly string[];
  auditRule: 'EVERY_DECISION_AND_RESULT';
}>;

export const externalCapabilityRegistry = new Map<ExternalCapabilityId, ExternalCapabilityRegistration>([
  ['OPENAI_MODELS_READ', { id:'OPENAI_MODELS_READ', provider:'OPENAI', access:'READ', scopes:['models.metadata'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:false, allowedActions:['LIST_MODELS'], allowedDomains:['api.openai.com'], auditRule:'EVERY_DECISION_AND_RESULT' }],
  ['SLACK_CHANNELS_READ', { id:'SLACK_CHANNELS_READ', provider:'SLACK', access:'READ', scopes:['channels.metadata'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:false, allowedActions:['LIST_ALLOWLISTED_CHANNELS'], allowedDomains:['slack.com'], auditRule:'EVERY_DECISION_AND_RESULT' }],
  ['SLACK_CHANNEL_HISTORY_READ', { id:'SLACK_CHANNEL_HISTORY_READ', provider:'SLACK', access:'READ', scopes:['channels.history:C0BJ5HMBB35','channels.history:C0BJ9R0Q13Q','channels.history:C0BJDNJSGU9','channels.history:C0BJ5HGQKLK','channels.history:C0BJFGGL4TE','channels.history:C0BJDMF01ND','channels.history:C0BJ9R1NPEJ','channels.history:C0BJDNWK9ED','channels.history:C0BJDM8NPLH'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:false, allowedActions:['READ_ALLOWLISTED_CHANNEL_HISTORY'], allowedDomains:['slack.com'], auditRule:'EVERY_DECISION_AND_RESULT' }],
  ['GMAIL_MESSAGE_STATUS_READ', { id:'GMAIL_MESSAGE_STATUS_READ', provider:'GMAIL', access:'READ', scopes:['message.status'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:false, allowedActions:['READ_STATUS'], allowedDomains:['gmail.googleapis.com'], auditRule:'EVERY_DECISION_AND_RESULT' }],
  ['GMAIL_COMPOSE_HANDOFF', { id:'GMAIL_COMPOSE_HANDOFF', provider:'GMAIL', access:'WRITE', scopes:['compose.email'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:true, allowedActions:['OPEN_COMPOSER'], allowedDomains:['local.android.intent'], auditRule:'EVERY_DECISION_AND_RESULT' }],
  ['WHATSAPP_HANDOFF', { id:'WHATSAPP_HANDOFF', provider:'WHATSAPP', access:'WRITE', scopes:['compose.message'], requiredEntitlement:'premium.voice-assistant', state:'ENABLED', confirmationRequired:true, allowedActions:['OPEN_PROVIDER_PICKER'], allowedDomains:['local.android.intent'], auditRule:'EVERY_DECISION_AND_RESULT' }],
]);
