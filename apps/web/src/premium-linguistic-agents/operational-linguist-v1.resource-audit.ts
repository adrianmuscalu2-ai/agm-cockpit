import {
  createCanonicalOperationalLinguist,
  linguisticResourceCounts,
  type OperationalLinguistV1Language,
} from '@agm/shared';
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
import { premiumLinguisticCapabilities } from './premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from './premium-linguistic-agents.registry';

export const operationalLinguistV1Targets = ['it', 'es', 'sv'].map(
  (language) => createCanonicalOperationalLinguist(language as OperationalLinguistV1Language),
);

export type OperationalLinguistV1ResourceAudit = {
  componentId: string;
  language: OperationalLinguistV1Language;
  operationalState: 'ONLINE' | 'DEGRADED';
  resources: {
    contractVersion: string;
    contractDigest: string;
    catalogDigest: string;
    app: number;
    operational: number;
    carMover: number;
    premium: number;
    total: number;
  };
  errors: { count: number; codes: string[] };
  resourceEvidenceCanonical: string;
};

export function auditCanonicalOperationalLinguist(
  language: OperationalLinguistV1Language,
): OperationalLinguistV1ResourceAudit {
  const definition = createCanonicalOperationalLinguist(language);
  const errors: string[] = [];
  const registration = premiumLinguisticAgents.find((agent) => agent.id === definition.componentId);
  if (!registration || registration.language !== language) errors.push('REGISTRY_ID_LANGUAGE_MISMATCH');
  if (!registration?.enabled || registration.status !== 'active') errors.push('REGISTRY_NOT_OPERATIONAL');
  if (registration && premiumLinguisticCapabilities.some((capability) => !registration.capabilities.includes(capability))) errors.push('CAPABILITY_MISSING');

  const canonicalApp = appI18nDictionary.en as Record<string, string>;
  const translatedApp = appI18nDictionary[language] as Record<string, string>;
  validateCatalog('app', canonicalApp, translatedApp, errors);

  const canonicalOperational = flatten({
    preDeparture: preDepartureCopy.en,
    afterDeparture: afterDepartureCopy.en,
    afterDepartureOperational: afterDepartureOperationalEnglish,
    emailTemplates: Object.fromEntries(emailTemplates.map((template) => [template.id, template.translations.en])),
    maintenance: maintenanceEnglishSource,
  });
  const translatedOperational = flatten(finalLanguageOperationalDictionary[language]);
  validateCatalog('operational', canonicalOperational, translatedOperational, errors);

  const carMover = carMoverI18nKeys.filter((key) => carMoverText(language, key)?.trim()).length;
  if (carMover !== carMoverI18nKeys.length) errors.push('carMover:MISSING');
  const premium = directPremiumCount(language, errors);
  const counts = linguisticResourceCounts({
    app: Object.keys(translatedApp).length,
    operational: Object.keys(translatedOperational).length,
    carMover,
    premium,
  });
  if (Object.entries(definition.resourceCounts).some(([key, expected]) => counts[key as keyof typeof counts] !== expected)) errors.push('RESOURCE_COUNT_MISMATCH');

  const resources = {
    contractVersion: definition.resourceContractVersion,
    contractDigest: definition.resourceContractDigest,
    ...counts,
  };
  const canonicalCatalogs = {
    app: sortedRecord(translatedApp),
    operational: sortedRecord(translatedOperational),
    carMover: Object.fromEntries([...carMoverI18nKeys].sort().map((key) => [key, carMoverText(language, key)])),
    premium: premiumCatalog(language),
  };
  return {
    componentId: definition.componentId,
    language,
    operationalState: errors.length ? 'DEGRADED' : 'ONLINE',
    resources: { ...resources, catalogDigest: definition.resourceCatalogDigest },
    errors: { count: errors.length, codes: errors },
    resourceEvidenceCanonical: JSON.stringify({
      baselineVersion: definition.baselineVersion,
      componentId: definition.componentId,
      language,
      resources,
      catalogs: canonicalCatalogs,
    }),
  };
}

function flatten(value: unknown, path = '', result: Record<string, string> = {}) {
  if (typeof value === 'string') result[path] = value;
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${path}.${index}`, result));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, result));
  return result;
}

function placeholders(value: string) {
  return [...value.matchAll(/\{+[a-zA-Z0-9_]+\}+/g)].map((match) => match[0]).sort().join('|');
}

function validateCatalog(name: string, canonical: Record<string, string>, translated: Record<string, string>, errors: string[]) {
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

function directPremiumCount(language: OperationalLinguistV1Language, errors: string[]) {
  const sources = [premiumAssistantUiMessages, premiumConversationMessages, premiumVoiceShellMessages, roadControlCopy, requiredDocumentCopy, fieldBatchCopy];
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

function premiumCatalog(language: OperationalLinguistV1Language) {
  const sources = [premiumAssistantUiMessages, premiumConversationMessages, premiumVoiceShellMessages, roadControlCopy, requiredDocumentCopy, fieldBatchCopy];
  return {
    capabilities: Object.fromEntries([...capabilityTextKeys].sort().map((key) => [key, capabilityText(language, key)])),
    copilot: Object.fromEntries([...copilotKeys].sort().map((key) => [key, copilotText(language, key)])),
    sources: sources.map((source) => sortedRecord(flatten(source[language]))),
  };
}

function sortedRecord(value: Record<string, string>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
