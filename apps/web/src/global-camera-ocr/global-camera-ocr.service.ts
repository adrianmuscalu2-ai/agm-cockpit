import type { AppViewName } from '../app-shell/app-state.contract';
import type { OcrProcessOutcome } from '../ocr/ocr.controller';

export const GLOBAL_CAMERA_OCR_VIEWS = [
  'home',
  'basic',
  'ocr',
  'access',
  'premium',
  'premiumCopilot',
  'premiumTeam',
  'premiumLoadSafety',
  'premiumCommunications',
  'premiumVoice',
  'carMover',
  'carMoverMenu',
  'carMoverPlanning',
  'carMoverActive',
  'carMoverCompletion',
  'carMoverAccounting',
  'carMoverGuide',
  'carMoverArchive',
  'cockpit',
  'email',
  'profile',
  'corrector',
  'turn',
  'legal',
  'about',
  'roadmap',
  'licenses',
] as const satisfies readonly AppViewName[];

export type GlobalCameraOcrOrigin = AppViewName;
export type GlobalCameraOcrFailure =
  | 'permission-denied'
  | 'camera-unavailable'
  | 'ocr-unavailable'
  | 'unsupported-file'
  | 'no-text'
  | 'processing-failed';

export type GlobalCameraOcrSession = {
  open: boolean;
  origin: GlobalCameraOcrOrigin | null;
  processing: boolean;
  text: string;
  confidence: number;
  imageDataUrl: string;
  quality: 'usable' | 'review-required' | null;
  failure: GlobalCameraOcrFailure | null;
};

export function isGlobalCameraOcrOrigin(view: string): view is GlobalCameraOcrOrigin {
  return (GLOBAL_CAMERA_OCR_VIEWS as readonly string[]).includes(view);
}

export function createGlobalCameraOcrService(dependencies: {
  process(file: File): Promise<OcrProcessOutcome>;
  applyResult(origin: GlobalCameraOcrOrigin, text: string): void;
  changed(): void;
}) {
  let session: GlobalCameraOcrSession = emptySession();

  const notify = () => dependencies.changed();
  const setFailure = (failure: GlobalCameraOcrFailure) => {
    session = { ...session, processing: false, failure };
    notify();
  };

  return {
    get snapshot(): Readonly<GlobalCameraOcrSession> {
      return session;
    },
    open(origin: GlobalCameraOcrOrigin): void {
      session = session.origin === origin
        ? { ...session, open: true, failure: null }
        : { ...emptySession(), open: true, origin };
      notify();
    },
    close(): void {
      session = { ...session, open: false, processing: false };
      notify();
    },
    clear(): void {
      const origin = session.origin;
      session = { ...emptySession(), open: session.open, origin };
      notify();
    },
    fail: setFailure,
    edit(text: string): void {
      session = { ...session, text, failure: null };
      if (session.origin && text.trim()) dependencies.applyResult(session.origin, text);
    },
    async process(file: File): Promise<void> {
      const origin = session.origin;
      if (!origin) return;
      session = { ...session, processing: true, failure: null };
      notify();
      const outcome = await dependencies.process(file);
      if (outcome.status === 'completed' || outcome.status === 'low-quality') {
        session = {
          ...session,
          processing: false,
          text: outcome.text,
          confidence: outcome.confidence,
          imageDataUrl: outcome.imageDataUrl,
          quality: outcome.status === 'completed' ? 'usable' : 'review-required',
          failure: null,
        };
        dependencies.applyResult(origin, outcome.text);
        notify();
        return;
      }
      setFailure(outcome.status);
    },
  };
}

function emptySession(): GlobalCameraOcrSession {
  return {
    open: false,
    origin: null,
    processing: false,
    text: '',
    confidence: 0,
    imageDataUrl: '',
    quality: null,
    failure: null,
  };
}
