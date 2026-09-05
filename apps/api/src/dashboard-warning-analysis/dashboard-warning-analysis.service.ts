import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { executeControlledVisionTransfer } from '../common/image-security/controlled-vision-transfer';
import { sanitizeImageForVision } from '../common/image-security/image-sanitizer';
import { dashboardWarningCatalog } from './dashboard-warning-analysis.catalog';
import type { DashboardWarningAnalysis, VisionCandidate } from './dashboard-warning-analysis.types';

type OpenAiPayload = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };

@Injectable()
export class DashboardWarningAnalysisService {
  constructor(private readonly config: ConfigService) {}

  async analyze(image: { buffer: Buffer; mimetype: string }): Promise<DashboardWarningAnalysis> {
    const sanitized = await sanitizeImageForVision(image.buffer, image.mimetype);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return uncertain(['Serviciul Vision nu este configurat. Solicită recaptură sau încearcă mai târziu.']);
    const prompt = [
      'Analyze only the visible vehicle dashboard warning symbol in this image.',
      'Transcribe visible dashboard text exactly as shown. Put it in visibleText; do not translate, correct, or infer missing characters.',
      'Never diagnose a component and never infer facts that are not visible.',
      'Select at most one candidate from: WL-001 STOP, WL-002 brake system, WL-003 ABS, WL-004 oil pressure, WL-005 coolant temperature, WL-006 charging/alternator, WL-007 engine malfunction, WL-008 low fuel, WL-009 AdBlue, WL-010 particulate filter.',
      'If the symbol is absent, obscured, ambiguous, or confidence is below 0.72, candidateId must be null.',
      'Return JSON only: {"observations":[string],"visibleText":[string],"candidateId":string|null,"confidence":number,"limitations":[string]}.',
    ].join(' ');
    try {
      const raw = await executeControlledVisionTransfer({ ownedImageBuffer: Buffer.from(sanitized.buffer), apiKey, model: this.config.get<string>('OPENAI_VISION_MODEL', 'gpt-4.1-mini'), prompt, timeoutMs: 45_000 });
      const parsed = parseDashboardWarningCandidate(extractText(raw as OpenAiPayload));
      const entry = parsed?.candidateId ? dashboardWarningCatalog[parsed.candidateId] : undefined;
      if (!parsed || !entry || parsed.confidence < 0.72) return uncertain(
        parsed?.limitations ?? ['Imaginea nu permite o identificare suficient de sigură. Recapturează martorul mai aproape și fără reflexii.'],
        parsed?.observations ?? [],
        parsed?.visibleText ?? [],
      );
      return {
        status: 'identified', observations: parsed.observations, visibleText: parsed.visibleText, candidateId: parsed.candidateId!, candidateLabel: entry.label,
        confidence: parsed.confidence, severity: entry.severity, explanation: entry.explanation, recommendedAction: entry.action,
        knowledgeReference: { packageId: 'KB-VEHICLE-WARN-001', itemId: parsed.candidateId!, route: `/knowledge/martori-bord#${parsed.candidateId}` },
        limitations: [...parsed.limitations, 'Confirmă simbolul, culoarea și mesajul în manualul exact al vehiculului.'],
        provenance: { observation: 'vision', identification: 'vision', explanation: 'knowledge', severity: 'policy' },
      };
    } catch {
      return uncertain(['Analiza Vision nu a putut fi finalizată. Imaginea nu a fost păstrată; încearcă din nou sau recapturează.']);
    }
  }
}

function uncertain(limitations: string[], observations: string[] = [], visibleText: string[] = []): DashboardWarningAnalysis {
  return { status: 'uncertain', observations, visibleText, confidence: 0, limitations, provenance: { observation: 'vision', identification: 'none', explanation: 'none', severity: 'none' } };
}
function extractText(payload: OpenAiPayload) { if (payload.output_text) return payload.output_text; for (const item of payload.output ?? []) for (const content of item.content ?? []) if (content.text) return content.text; return ''; }
export function parseDashboardWarningCandidate(text: string): VisionCandidate | undefined {
  try {
    const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const value = JSON.parse(normalized) as VisionCandidate;
    if (!Array.isArray(value.observations) || !Array.isArray(value.visibleText) || !Array.isArray(value.limitations) || typeof value.confidence !== 'number') return;
    return {
      observations: value.observations.slice(0, 6).map(String),
      visibleText: value.visibleText.slice(0, 8).map(String),
      limitations: value.limitations.slice(0, 6).map(String),
      candidateId: typeof value.candidateId === 'string' ? value.candidateId : null,
      confidence: Math.max(0, Math.min(1, value.confidence)),
    };
  } catch { return; }
}
