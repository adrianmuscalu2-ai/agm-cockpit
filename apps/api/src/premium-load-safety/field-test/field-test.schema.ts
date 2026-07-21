const roles = ['front-oblique', 'rear-oblique', 'opposite-side', 'strap-label', 'anchor-point', 'cargo-detail'];
const item = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    statement: { type: 'string' },
    certainty: { type: 'string', enum: ['observed', 'probable', 'undetermined'] },
    sources: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', enum: ['photo', 'confirmed-ocr', 'user-declared', 'unknown'] },
    },
    explanation: { type: 'string' },
    photoRoles: { type: 'array', items: { type: 'string', enum: roles } },
  },
  required: ['id', 'statement', 'certainty', 'sources', 'explanation', 'photoRoles'],
} as const;

export const fieldTestReportSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    observations: { type: 'array', items: item },
    visibleRisks: { type: 'array', items: item },
    recommendations: { type: 'array', items: item },
    missingInformation: { type: 'array', items: item },
    conflicts: { type: 'array', items: item },
  },
  required: ['observations', 'visibleRisks', 'recommendations', 'missingInformation', 'conflicts'],
} as const;
