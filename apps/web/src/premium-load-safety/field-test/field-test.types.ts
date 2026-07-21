export type FieldPhotoRole =
  | 'front-oblique'
  | 'rear-oblique'
  | 'opposite-side'
  | 'strap-label'
  | 'anchor-point'
  | 'cargo-detail';

export type FieldPhotoQuality = {
  usable: boolean;
  width: number;
  height: number;
  sharpness: number;
  exposure: number;
  issues: Array<'resolution' | 'blur' | 'dark' | 'bright'>;
};

export type FieldPhoto = {
  role: FieldPhotoRole;
  file: File;
  previewUrl: string;
  quality?: FieldPhotoQuality;
  checking: boolean;
};

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

export type FieldReportSource = 'photo' | 'confirmed-ocr' | 'user-declared' | 'unknown';

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
