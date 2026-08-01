import { t } from '../i18n/app-i18n';
import type { UiLanguage } from '../i18n/app-i18n.types';
import { analyzeLoadSafetyImage, LoadSafetyApiError } from './load-safety.api';
import { validateLoadSafetyImageFile } from './load-safety.module';
import { loadSafetyUiState, renderLoadSafetyContent } from './load-safety.view';
import {
  generateSecuringRecommendation,
  toggleWhy,
  updateRecommendationInput,
} from './securing-recommendation/securing-recommendation.controller';
import { resetSecuringRecommendation } from './securing-recommendation/securing-recommendation.state';
import {
  generateFieldReport,
  runFieldOcr,
  selectFieldPhoto,
  toggleFieldWhy,
  updateFieldInput,
} from './field-test/field-test.controller';

type AppWindow = Window & { __agmLoadSafetyControllerBound?: boolean };

const appWindow = typeof window === 'undefined' ? undefined : (window as AppWindow);

if (appWindow && typeof document !== 'undefined' && !appWindow.__agmLoadSafetyControllerBound) {
  void import('./load-safety.css');
  appWindow.__agmLoadSafetyControllerBound = true;
  document.addEventListener('change', onDocumentChange);
  document.addEventListener('click', onDocumentClick);
}

async function onDocumentChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.dataset.fieldPhoto) {
    const operation = selectFieldPhoto(input);
    refresh();
    await operation;
    refresh();
    return;
  }
  if (updateFieldInput(input)) return;
  if (updateRecommendationInput(input)) return;
  if (input.id !== 'loadSafetyGalleryInput' && input.id !== 'loadSafetyCameraInput') return;
  const image = input.files?.[0];
  if (!image) return;

  const validation = validateLoadSafetyImageFile(image);
  if (!validation.valid) {
    loadSafetyUiState.statusKey = `premium.loadSafety.status.${validation.reason}`;
    refresh();
    return;
  }

  if (loadSafetyUiState.previewUrl) URL.revokeObjectURL(loadSafetyUiState.previewUrl);
  loadSafetyUiState.image = image;
  loadSafetyUiState.previewUrl = URL.createObjectURL(image);
  loadSafetyUiState.analysis = undefined;
  resetSecuringRecommendation();
  loadSafetyUiState.statusKey = 'premium.loadSafety.status.selected';
  refresh();
}

async function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (toggleFieldWhy(target)) {
    refresh();
    return;
  }
  if (target.closest('#runFieldLabelOcr')) {
    const operation = runFieldOcr(normalizeLanguage(document.documentElement.lang));
    refresh();
    await operation;
    refresh();
    return;
  }
  if (target.closest('#generateFieldTestReport')) {
    const operation = generateFieldReport(document.documentElement.lang || 'ro');
    refresh();
    await operation;
    refresh();
    return;
  }
  if (toggleWhy(target)) {
    refresh();
    return;
  }
  if (target.closest('#generateSecuringRecommendation')) {
    refreshRecommendationProcessing(
      generateSecuringRecommendation(loadSafetyUiState, document.documentElement.lang || 'ro'),
    );
    return;
  }
  if (!target.closest('#analyzeLoadSafety') || !loadSafetyUiState.image || loadSafetyUiState.processing) return;

  loadSafetyUiState.processing = true;
  refresh();
  try {
    loadSafetyUiState.analysis = await analyzeLoadSafetyImage(
      loadSafetyUiState.image,
      document.documentElement.lang || 'ro',
    );
    loadSafetyUiState.statusKey = 'premium.loadSafety.status.ready';
  } catch (error) {
    console.error('Premium load safety analysis failed.', error);
    loadSafetyUiState.statusKey = statusKeyForError(error);
  } finally {
    loadSafetyUiState.processing = false;
    refresh();
  }
}

async function refreshRecommendationProcessing(operation: Promise<boolean>) {
  refresh();
  await operation;
  refresh();
}

function statusKeyForError(error: unknown) {
  if (!(error instanceof LoadSafetyApiError)) return 'premium.loadSafety.status.failed';
  if (error.reason === 'configuration') return 'premium.loadSafety.status.configuration';
  if (error.reason === 'network') return 'premium.loadSafety.status.network';
  if (error.reason === 'endpoint') return 'premium.loadSafety.status.endpoint';
  if (error.reason === 'provider') return 'premium.loadSafety.status.provider';
  return 'premium.loadSafety.status.failed';
}

function refresh() {
  const root = document.querySelector<HTMLElement>('#loadSafetyModule');
  if (!root) return;
  const language = normalizeLanguage(document.documentElement.lang);
  root.innerHTML = renderLoadSafetyContent((key) => t(language, key), escapeHtml);
}

function normalizeLanguage(value: string): UiLanguage {
  return value === 'de' || value === 'en' ? value : 'ro';
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
