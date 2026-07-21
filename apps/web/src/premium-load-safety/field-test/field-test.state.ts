import type {
  FieldPhoto,
  FieldPhotoRole,
  FieldTestInput,
  FieldTestReport,
} from './field-test.types';

export const requiredFieldPhotoRoles: readonly FieldPhotoRole[] = ['front-oblique', 'rear-oblique'];
export const optionalFieldPhotoRoles: readonly FieldPhotoRole[] = ['opposite-side', 'anchor-point', 'strap-label', 'cargo-detail'];

export const fieldTestState = {
  photos: {} as Partial<Record<FieldPhotoRole, FieldPhoto>>,
  input: {
    antiSlipMats: 'unknown',
    edgeProtectors: 'unknown',
    frontSupported: 'unknown',
    oppositeSide: 'unknown',
    ocrConfirmed: false,
  } as FieldTestInput,
  ocr: {
    processing: false,
    rawText: '',
    confidence: 0,
  },
  report: undefined as FieldTestReport | undefined,
  processing: false,
  statusKey: 'premium.loadSafety.field.status.ready',
  expandedWhy: new Set<string>(),
};

export function fieldTestCanAnalyze() {
  return requiredFieldPhotoRoles.every((role) => fieldTestState.photos[role]?.quality?.usable);
}
