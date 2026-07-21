import type { UiLanguage } from '../../i18n/app-i18n.types';
import { LoadSafetyApiError } from '../load-safety.api';
import { requestFieldTestReport } from './field-test.api';
import { readStrapLabel } from './field-test.ocr';
import { inspectFieldPhoto, prepareFieldPhoto } from './field-test.quality';
import { fieldTestCanAnalyze, fieldTestState } from './field-test.state';
import type { FieldPhotoRole, FieldTestInput } from './field-test.types';

export async function selectFieldPhoto(input: HTMLInputElement) {
  const role = input.dataset.fieldPhoto as FieldPhotoRole | undefined;
  const file = input.files?.[0];
  if (!role || !file) return false;
  const previous = fieldTestState.photos[role];
  if (previous) URL.revokeObjectURL(previous.previewUrl);
  const preparedFile = await prepareFieldPhoto(file);
  fieldTestState.photos[role] = { role, file: preparedFile, previewUrl: URL.createObjectURL(preparedFile), checking: true };
  fieldTestState.report = undefined;
  try {
    fieldTestState.photos[role]!.quality = await inspectFieldPhoto(preparedFile);
    fieldTestState.statusKey = fieldTestCanAnalyze()
      ? 'premium.loadSafety.field.status.photosReady'
      : 'premium.loadSafety.field.status.ready';
  } catch {
    fieldTestState.photos[role]!.quality = {
      usable: false, width: 0, height: 0, sharpness: 0, exposure: 0, issues: ['resolution'],
    };
  } finally {
    fieldTestState.photos[role]!.checking = false;
  }
  return true;
}

export function updateFieldInput(target: HTMLInputElement | HTMLSelectElement) {
  if (!target.closest('#fieldTestForm')) return false;
  const name = target.name as keyof FieldTestInput;
  if (!name) return false;
  if (name === 'ocrConfirmed') {
    fieldTestState.input.ocrConfirmed = (target as HTMLInputElement).checked;
  } else if (target instanceof HTMLInputElement && target.type === 'number') {
    fieldTestState.input[name] = (target.value ? Number(target.value) : undefined) as never;
  } else {
    fieldTestState.input[name] = (target.value || undefined) as never;
  }
  fieldTestState.report = undefined;
  return true;
}

export async function runFieldOcr(language: UiLanguage) {
  const photo = fieldTestState.photos['strap-label'];
  if (!photo || fieldTestState.ocr.processing) return false;
  fieldTestState.ocr.processing = true;
  try {
    const result = await readStrapLabel(photo.file, language);
    fieldTestState.ocr.rawText = result.text;
    fieldTestState.ocr.confidence = result.confidence;
    fieldTestState.input.confirmedLcDan = result.isUsable ? result.lcDan : undefined;
    fieldTestState.input.confirmedStfDan = result.isUsable ? result.stfDan : undefined;
    fieldTestState.input.ocrConfirmed = false;
    fieldTestState.statusKey = result.isUsable
      ? 'premium.loadSafety.field.status.ocrReview'
      : 'premium.loadSafety.field.status.ocrUnclear';
  } finally {
    fieldTestState.ocr.processing = false;
  }
  return true;
}

export async function generateFieldReport(language: string) {
  if (!fieldTestCanAnalyze() || fieldTestState.processing) return false;
  fieldTestState.processing = true;
  try {
    fieldTestState.report = await requestFieldTestReport(language, fieldTestState.input);
    fieldTestState.expandedWhy.clear();
    fieldTestState.statusKey = 'premium.loadSafety.field.status.complete';
  } catch (error) {
    fieldTestState.statusKey =
      error instanceof LoadSafetyApiError
        ? `premium.loadSafety.field.status.${error.reason}`
        : 'premium.loadSafety.field.status.failed';
  } finally {
    fieldTestState.processing = false;
  }
  return true;
}

export function toggleFieldWhy(target: HTMLElement) {
  const id = target.closest<HTMLElement>('[data-field-why]')?.dataset.fieldWhy;
  if (!id) return false;
  if (fieldTestState.expandedWhy.has(id)) fieldTestState.expandedWhy.delete(id);
  else fieldTestState.expandedWhy.add(id);
  return true;
}
