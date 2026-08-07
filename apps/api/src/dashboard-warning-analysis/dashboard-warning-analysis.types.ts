export type DashboardWarningSeverity = 'critical' | 'warning' | 'information';

export type DashboardWarningAnalysis = {
  status: 'identified' | 'uncertain';
  observations: string[];
  candidateId?: string;
  candidateLabel?: string;
  confidence: number;
  severity?: DashboardWarningSeverity;
  explanation?: string;
  recommendedAction?: string;
  knowledgeReference?: { packageId: string; itemId: string; route: string };
  limitations: string[];
  provenance: {
    observation: 'vision';
    identification: 'vision' | 'none';
    explanation: 'knowledge' | 'none';
    severity: 'policy' | 'none';
  };
};

export type VisionCandidate = {
  observations: string[];
  candidateId: string | null;
  confidence: number;
  limitations: string[];
};
