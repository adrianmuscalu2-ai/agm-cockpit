import type { LanguageCode } from '../emailLanguage';

export const OCR_DOCUMENT_SCHEMA_VERSION = 2 as const;

export type OcrDocumentStatus = 'recognized' | 'reviewed' | 'translated';

export type OcrDocument = {
  id: string;
  schemaVersion: typeof OCR_DOCUMENT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  source: {
    kind: 'camera' | 'file';
    fileName?: string;
    mimeType: string;
    byteSize: number;
  };
  image: Blob;
  thumbnail: Blob;
  extractedText: string;
  editedText: string;
  confidence: number;
  sourceLanguage: LanguageCode;
  translation?: {
    targetLanguage: LanguageCode;
    text: string;
    createdAt: string;
  };
  status: OcrDocumentStatus;
  pinned: boolean;
};

export type NewOcrDocument = Omit<
  OcrDocument,
  'schemaVersion' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
};

export type OcrDocumentUpdate = Partial<
  Pick<
    OcrDocument,
    'editedText' | 'confidence' | 'sourceLanguage' | 'translation' | 'status' | 'pinned'
  >
>;

export type OcrDocumentListOptions = {
  query?: string;
  limit?: number;
  beforeCreatedAt?: string;
};

