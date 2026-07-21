import type { UploadedImage } from '../premium-load-safety.types';

export type FieldPhotoRole = 'front-oblique' | 'rear-oblique' | 'opposite-side' | 'strap-label' | 'anchor-point' | 'cargo-detail';
export type FieldReportSource = 'photo' | 'confirmed-ocr' | 'user-declared' | 'unknown';

export type FieldTestPhoto = UploadedImage & { role: FieldPhotoRole };

export type FieldTestInput = {
  weightKg?: number;
  cargoType?: string;
  antiSlipMats: 'yes' | 'no' | 'unknown';
  edgeProtectors: 'yes' | 'no' | 'unknown';
  frontSupported: 'yes' | 'no' | 'unknown';
  oppositeSide: 'visible' | 'not-visible' | 'confirmed-symmetric' | 'unknown';
  confirmedLcDan?: number;
  confirmedStfDan?: number;
  ocrConfirmed: boolean;
};

export type FieldReportItem = {
  id: string;
  statement: string;
  certainty: 'observed' | 'probable' | 'undetermined';
  sources: FieldReportSource[];
  explanation: string;
  photoRoles: FieldPhotoRole[];
};

export type FieldTestReport = {
  observations: FieldReportItem[];
  visibleRisks: FieldReportItem[];
  recommendations: FieldReportItem[];
  missingInformation: FieldReportItem[];
  conflicts: FieldReportItem[];
};
