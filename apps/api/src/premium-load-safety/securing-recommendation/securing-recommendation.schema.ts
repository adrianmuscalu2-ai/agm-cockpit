const observationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    conclusion: { type: 'string' },
    certainty: { type: 'string', enum: ['observed', 'probable', 'undetermined'] },
    sources: {
      type: 'array',
      items: { type: 'string', enum: ['visual', 'user-declared', 'general-practice'] },
    },
    explanation: { type: 'string' },
  },
  required: ['id', 'conclusion', 'certainty', 'sources', 'explanation'],
} as const;

export const securingRecommendationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    visibleStraps: {
      type: 'object',
      additionalProperties: false,
      properties: {
        estimatedCount: { type: ['integer', 'null'] },
        recommendedCount: { type: 'null' },
        observations: { type: 'array', items: observationSchema },
      },
      required: ['estimatedCount', 'recommendedCount', 'observations'],
    },
    recommendations: { type: 'array', items: observationSchema },
    lcStf: { type: 'array', minItems: 1, items: observationSchema },
    additionalElements: { type: 'array', items: observationSchema },
    missingData: { type: 'array', items: { type: 'string' } },
  },
  required: ['visibleStraps', 'recommendations', 'lcStf', 'additionalElements', 'missingData'],
} as const;
