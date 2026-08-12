import type { BasicLanguageCode } from '../language-registry';
import { authorizedSituationRegistry } from './situation.registry';
import type { AnyAuthorizedSituationId, CaseCommand, OperationalCase } from './situation-router.types';

export function createOperationalCase(id: string, situationId: AnyAuthorizedSituationId, language: BasicLanguageCode, now = new Date().toISOString()): OperationalCase {
  const definition = authorizedSituationRegistry[situationId];
  return { schemaVersion:1, id, situationId, definitionVersion:definition.version, language,
    state:definition.initialState, activeStep:definition.steps[0], completedSteps:[], data:{}, evidence:[], externalEffects:[], revision:0, updatedAt:now };
}

const update = (value: OperationalCase, patch: Partial<OperationalCase>): OperationalCase =>
  ({ ...value, ...patch, revision:value.revision + 1, updatedAt:new Date().toISOString() });

export function transitionOperationalCase(value: OperationalCase, command: CaseCommand): OperationalCase {
  const definition = authorizedSituationRegistry[value.situationId];
  if (value.state === 'RESOLVED' || value.state === 'ESCALATED') return value;
  if (command.type === 'CONFIRM_SAFE_INTERACTION') {
    if (value.situationId !== 'road-control' || value.activeStep !== 'safe-interaction') return value;
    return command.safe
      ? update(value, { state:'ACTIVE_STEP', activeStep:'safe-stop', completedSteps:[...value.completedSteps,'safe-interaction'], data:{...value.data,safeToInteract:true} })
      : update(value, { state:'SAFETY_GATE', data:{...value.data,safeToInteract:false} });
  }
  if (command.type === 'CONFIRM_SAFE_STOP') {
    if (value.situationId !== 'road-control' || value.data.safeToInteract !== true) return value;
    return update(value, { state:'QUALIFYING', activeStep:'qualify-request', completedSteps:[...value.completedSteps,'safe-stop'], data:{...value.data,safelyStopped:true} });
  }
  if (value.situationId === 'road-control' && value.data.safelyStopped !== true && !['SET_DATA'].includes(command.type)) return value;
  if (command.type === 'SET_DATA') return update(value, { data:{...value.data,...command.values} });
  if (command.type === 'ADD_EVIDENCE') {
    if (value.evidence.some((item) => item.id === command.evidence.id)) return value;
    if (command.evidence.kind === 'ocr-proposal') {
      const source=value.evidence.find((item)=>item.kind==='original'&&item.id===command.evidence.sourceId);
      if (!source || source.sha256!==command.evidence.sourceSha256 || !command.evidence.initialText) return value;
    }
    if (command.evidence.kind === 'human-confirmation') {
      const source=value.evidence.find((item)=>item.kind==='ocr-proposal'&&item.id===command.evidence.sourceId);
      if (!source || source.sha256!==command.evidence.sourceSha256 || !command.evidence.confirmedText || !command.evidence.confirmedAt || !command.evidence.confirmedBy) return value;
    }
    return update(value, { evidence:[...value.evidence, command.evidence], state:command.evidence.kind === 'ocr-proposal' ? 'REVIEW_REQUIRED' : value.state });
  }
  if (command.type === 'REQUIRE_RECOVERY') return update(value,{state:'RECOVERY_REQUIRED',data:{...value.data,recoveryReason:command.reason}});
  if (command.type === 'ADVANCE') {
    const index = definition.steps.indexOf(value.activeStep);
    const next = definition.steps[index + 1];
    return next ? update(value, { activeStep:next, state:'ACTIVE_STEP', completedSteps:[...new Set([...value.completedSteps,value.activeStep])] }) : value;
  }
  if (command.type === 'BLOCK') return update(value, { state:'BLOCKED' });
  if (command.type === 'REMEDIATE') return update(value, { state:'REVIEW_REQUIRED' });
  if (command.type === 'CONFIRM_READY') {
    const original=value.evidence.find((item)=>item.kind==='original');
    const ocr=value.evidence.find((item)=>item.kind==='ocr-proposal'&&item.sourceId===original?.id&&item.sourceSha256===original?.sha256);
    const confirmation=value.evidence.find((item)=>item.kind==='human-confirmation'&&item.sourceId===ocr?.id&&item.sourceSha256===ocr?.sha256);
    const expiry=typeof value.data.validUntil==='string'?classifyDocumentExpiry(value.data.validUntil):'INVALID';
    const eligible = value.situationId === 'required-document' && value.data.textConfirmed === true &&
      value.data.readable === true && (expiry === 'VALID' || expiry === 'WARNING') && value.data.severity !== 'blocking' &&
      (expiry !== 'WARNING' || value.data.warningConfirmed === true) && Boolean(original&&ocr&&confirmation);
    return eligible ? update(value, { state:'RESOLVED', data:{...value.data,readyConfirmed:true,readyConfirmedAt:new Date().toISOString()} }) : value;
  }
  if (command.type === 'SET_DISPOSITION') return update(value, { state:command.disposition });
  if (command.type === 'PREPARE_EXTERNAL') {
    const existing = value.externalEffects.find((item) => item.operationId === command.effect.operationId);
    return existing ? value : update(value, { externalEffects:[...value.externalEffects,{...command.effect,phase:'PREPARED'}] });
  }
  const effectIndex = 'operationId' in command ? value.externalEffects.findIndex((item) => item.operationId === command.operationId) : -1;
  if (effectIndex < 0) return value;
  const effect = value.externalEffects[effectIndex];
  if (effect.phase === 'RECEIPT_CONFIRMED') return value;
  const phase = command.type === 'CONFIRM_EXTERNAL' && effect.phase === 'PREPARED' ? 'HUMAN_CONFIRMED'
    : command.type === 'MARK_SENT' && effect.phase === 'HUMAN_CONFIRMED' ? 'SENT'
    : command.type === 'RECORD_RECEIPT' && effect.phase === 'SENT' ? 'RECEIPT_CONFIRMED' : effect.phase;
  const effects = [...value.externalEffects];
  effects[effectIndex] = { ...effect, phase, providerReceipt:command.type === 'RECORD_RECEIPT' && phase === 'RECEIPT_CONFIRMED' ? command.receipt : effect.providerReceipt };
  return phase === effect.phase ? value : update(value, { externalEffects:effects });
}

export type DocumentExpiryStatus = 'VALID'|'WARNING'|'EXPIRED'|'INVALID';
export function classifyDocumentExpiry(validUntil:string, now=new Date()):DocumentExpiryStatus {
  const expires=new Date(`${validUntil}T23:59:59.999`);
  if (!validUntil || Number.isNaN(expires.getTime())) return 'INVALID';
  if (expires.getTime()<now.getTime()) return 'EXPIRED';
  return expires.getTime()-now.getTime()<=30*24*60*60*1000?'WARNING':'VALID';
}
