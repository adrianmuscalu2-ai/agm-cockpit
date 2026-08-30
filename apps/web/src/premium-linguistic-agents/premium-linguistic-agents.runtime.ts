import { authenticatedApiFetch } from '../authenticated-api';
import { carMoverI18nKeys, carMoverText } from '../car-mover/car-mover.i18n';
import { emailTemplates } from '../emailTemplates';
import { appI18nDictionary } from '../i18n/app-i18n.dictionary';
import { finalLanguageOperationalDictionary } from '../i18n/final-language-operational.dictionary';
import { maintenanceEnglishSource } from '../maintenance-department';
import { afterDepartureCopy } from '../poc02-after-departure/after-departure.i18n';
import { afterDepartureOperationalEnglish } from '../poc02-after-departure/after-departure.operational-i18n';
import { capabilityText, capabilityTextKeys } from '../premium-capabilities/capability.i18n';
import { copilotKeys, copilotText } from '../premium-copilot/copilot.i18n';
import { premiumAssistantUiMessages } from '../premium-voice-shell/premium-assistant-ui.i18n';
import { premiumConversationMessages } from '../premium-voice-shell/premium-conversation.i18n';
import { premiumVoiceShellMessages } from '../premium-voice-shell/premium-voice-shell.i18n';
import { fieldBatchCopy } from '../premium-situation-router/field-batch.i18n';
import { roadControlCopy } from '../premium-situation-router/road-control.i18n';
import { requiredDocumentCopy } from '../premium-situation-router/required-document.i18n';
import { preDepartureCopy } from '../pre-departure/pre-departure.i18n';
import { recordRuntimeOperationSnapshot } from '../operations-health';
import { premiumLinguisticCapabilities } from './premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from './premium-linguistic-agents.registry';

export const finalLanguageAgentTargets = [
  { id: 'premium-linguist-it', language: 'it' },
  { id: 'premium-linguist-es', language: 'es' },
  { id: 'premium-linguist-sv', language: 'sv' },
] as const;

export type FinalLanguageAgentId = (typeof finalLanguageAgentTargets)[number]['id'];
export type FinalLanguageAgentCode = (typeof finalLanguageAgentTargets)[number]['language'];

export type LinguisticAgentResourceCounts = {
  app: number;
  operational: number;
  carMover: number;
  premium: number;
  total: number;
};

export type LinguisticAgentHeartbeat = {
  agentId: FinalLanguageAgentId;
  language: FinalLanguageAgentCode;
  status: 'ONLINE' | 'DEGRADED';
  observedAt: string;
  reason: 'I18N_RESOURCES_VALIDATED' | 'I18N_RESOURCE_VALIDATION_FAILED';
  counts: LinguisticAgentResourceCounts;
  errors: string[];
  apiJournaled: boolean;
};

const expectedCounts: LinguisticAgentResourceCounts = {
  app: 1155,
  operational: 308,
  carMover: 37,
  premium: 199,
  total: 1699,
};
const heartbeatIntervalMs = 60_000;
const heartbeatJournalLimit = 50;
const heartbeatJournal: LinguisticAgentHeartbeat[] = [];
let heartbeatBound = false;
let heartbeatTimer: number | undefined;

function flatten(value: unknown, path = '', result: Record<string, string> = {}) {
  if (typeof value === 'string') result[path] = value;
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${path}.${index}`, result));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, result));
  }
  return result;
}

function placeholders(value: string) {
  return [...value.matchAll(/\{+[a-zA-Z0-9_]+\}+/g)].map((match) => match[0]).sort().join('|');
}

function validateCatalog(
  name: string,
  canonical: Record<string, string>,
  translated: Record<string, string>,
  errors: string[],
) {
  const canonicalKeys = Object.keys(canonical).sort();
  const translatedKeys = Object.keys(translated).sort();
  if (canonicalKeys.join('\n') !== translatedKeys.join('\n')) errors.push(`${name}:KEY_PARITY`);
  for (const key of canonicalKeys) {
    const value = translated[key];
    if (!value?.trim()) errors.push(`${name}.${key}:EMPTY`);
    else if (value.includes('__AGM_TOKEN_')) errors.push(`${name}.${key}:UNRESOLVED_TOKEN`);
    else if (placeholders(value) !== placeholders(canonical[key])) errors.push(`${name}.${key}:PLACEHOLDER_MISMATCH`);
  }
}

function directPremiumCount(language: FinalLanguageAgentCode, errors: string[]) {
  const sources = [
    premiumAssistantUiMessages,
    premiumConversationMessages,
    premiumVoiceShellMessages,
    roadControlCopy,
    requiredDocumentCopy,
    fieldBatchCopy,
  ];
  let count = capabilityTextKeys.length + copilotKeys.length;
  if (!capabilityTextKeys.every((key) => capabilityText(language, key)?.trim())) errors.push('premium.capabilities:MISSING');
  if (!copilotKeys.every((key) => copilotText(language, key)?.trim())) errors.push('premium.copilot:MISSING');
  for (const [index, source] of sources.entries()) {
    const canonical = flatten(source.en);
    const translated = flatten(source[language]);
    validateCatalog(`premium.${index}`, canonical, translated, errors);
    count += Object.keys(translated).length;
  }
  return count;
}

export function auditPremiumLinguisticAgent(
  target: (typeof finalLanguageAgentTargets)[number],
  observedAt = new Date(),
): LinguisticAgentHeartbeat {
  const errors: string[] = [];
  const registration = premiumLinguisticAgents.find((agent) => agent.id === target.id);
  if (!registration || registration.language !== target.language) errors.push('REGISTRY_ID_LANGUAGE_MISMATCH');
  if (!registration?.enabled || registration.status !== 'active') errors.push('REGISTRY_NOT_OPERATIONAL');
  if (registration && premiumLinguisticCapabilities.some((capability) => !registration.capabilities.includes(capability))) {
    errors.push('CAPABILITY_MISSING');
  }

  const canonicalApp = appI18nDictionary.en as Record<string, string>;
  const translatedApp = appI18nDictionary[target.language] as Record<string, string>;
  validateCatalog('app', canonicalApp, translatedApp, errors);

  const canonicalOperational = flatten({
    preDeparture: preDepartureCopy.en,
    afterDeparture: afterDepartureCopy.en,
    afterDepartureOperational: afterDepartureOperationalEnglish,
    emailTemplates: Object.fromEntries(emailTemplates.map((template) => [template.id, template.translations.en])),
    maintenance: maintenanceEnglishSource,
  });
  const translatedOperational = flatten(finalLanguageOperationalDictionary[target.language]);
  validateCatalog('operational', canonicalOperational, translatedOperational, errors);

  const carMover = carMoverI18nKeys.filter((key) => carMoverText(target.language, key)?.trim()).length;
  if (carMover !== carMoverI18nKeys.length) errors.push('carMover:MISSING');
  const premium = directPremiumCount(target.language, errors);
  const counts = {
    app: Object.keys(translatedApp).length,
    operational: Object.keys(translatedOperational).length,
    carMover,
    premium,
    total: Object.keys(translatedApp).length + Object.keys(translatedOperational).length + carMover + premium,
  };
  if (Object.entries(expectedCounts).some(([key, expected]) => counts[key as keyof LinguisticAgentResourceCounts] !== expected)) {
    errors.push('RESOURCE_COUNT_MISMATCH');
  }
  return {
    agentId: target.id,
    language: target.language,
    status: errors.length ? 'DEGRADED' : 'ONLINE',
    observedAt: observedAt.toISOString(),
    reason: errors.length ? 'I18N_RESOURCE_VALIDATION_FAILED' : 'I18N_RESOURCES_VALIDATED',
    counts,
    errors,
    apiJournaled: false,
  };
}

function heartbeatDetail(heartbeat: LinguisticAgentHeartbeat) {
  const { app, operational, carMover, premium, total } = heartbeat.counts;
  return `language=${heartbeat.language};app=${app};operational=${operational};carMover=${carMover};premium=${premium};total=${total};errors=${heartbeat.errors.length}`;
}

async function publishHeartbeat(target: (typeof finalLanguageAgentTargets)[number]) {
  const heartbeat = auditPremiumLinguisticAgent(target);
  recordRuntimeOperationSnapshot(target.id, heartbeat.status, heartbeat.reason, heartbeatDetail(heartbeat));
  if (document.visibilityState === 'visible') {
    try {
      const response = await authenticatedApiFetch(`/operations/components/${target.id}/heartbeat`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: heartbeat.status, reason: heartbeat.reason, detail: heartbeatDetail(heartbeat) }),
      });
      heartbeat.apiJournaled = response.ok;
    } catch {
      heartbeat.apiJournaled = false;
    }
  }
  heartbeatJournal.push(heartbeat);
  if (heartbeatJournal.length > heartbeatJournalLimit) heartbeatJournal.splice(0, heartbeatJournal.length - heartbeatJournalLimit);
  return heartbeat;
}

export async function publishPremiumLinguisticAgentHeartbeats() {
  return Promise.all(finalLanguageAgentTargets.map(publishHeartbeat));
}

export function bindPremiumLinguisticAgentHeartbeats(onHeartbeat?: (heartbeats: LinguisticAgentHeartbeat[]) => void) {
  if (heartbeatBound) return;
  heartbeatBound = true;
  const publish = () => { void publishPremiumLinguisticAgentHeartbeats().then((heartbeats) => onHeartbeat?.(heartbeats)); };
  publish();
  heartbeatTimer = window.setInterval(publish, heartbeatIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') publish();
  });
}

export function premiumLinguisticAgentAuditTrail() {
  return heartbeatJournal.map((entry) => ({ ...entry, counts: { ...entry.counts }, errors: [...entry.errors] }));
}

export function stopPremiumLinguisticAgentHeartbeatsForTest() {
  if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  heartbeatBound = false;
  heartbeatJournal.length = 0;
}
