import { LoadSafetyApiError, loadSafetyEndpointUrl } from '../load-safety.api';
import type { FieldTestInput, FieldTestReport } from './field-test.types';
import { fieldTestState } from './field-test.state';

type FieldTestEnvelope = { data?: { available?: boolean; report?: FieldTestReport } };

export const fieldTestEndpointUrl = loadSafetyEndpointUrl?.replace(/\/analyze$/, '/field-test');

export async function requestFieldTestReport(language: string, input: FieldTestInput) {
  if (!fieldTestEndpointUrl) throw new LoadSafetyApiError('configuration');
  const photos = Object.values(fieldTestState.photos).filter(Boolean);
  const body = new FormData();
  for (const photo of photos) {
    body.append('photos', photo.file, photo.file.name);
  }
  body.append('roles', JSON.stringify(photos.map((photo) => photo.role)));
  body.append('input', JSON.stringify(input));
  body.append('language', language);

  let response: Response;
  try {
    response = await fetch(fieldTestEndpointUrl, { method: 'POST', body });
  } catch {
    throw new LoadSafetyApiError('network');
  }
  if (!response.ok) {
    if (response.status === 404) throw new LoadSafetyApiError('endpoint', response.status);
    if (response.status === 503) throw new LoadSafetyApiError('provider', response.status);
    throw new LoadSafetyApiError('request', response.status);
  }
  const payload = (await response.json()) as FieldTestEnvelope;
  if (!payload.data?.available || !payload.data.report) throw new LoadSafetyApiError('provider', response.status);
  return payload.data.report;
}
