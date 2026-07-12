import { textCorrectorAgents } from './text-corrector.agents';
import { type TextCorrectorRequest, type TextCorrectorResult } from './text-corrector.types';

export function correctText(request: TextCorrectorRequest): TextCorrectorResult {
  const agent = textCorrectorAgents.find((candidate) => candidate.canHandle(request)) ?? textCorrectorAgents[0];

  return agent.correct(request);
}

export function availableTextCorrectorAgentIds() {
  return textCorrectorAgents.map((agent) => agent.id);
}
