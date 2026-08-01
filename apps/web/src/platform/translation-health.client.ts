export async function fetchHealthEndpoint(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const probeUrl = new URL(url, window.location.href);
    probeUrl.searchParams.set('_agm_probe', String(Date.now()));
    const response = await fetch(probeUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchFunctionalTranslationHealth(
  healthUrl: string,
  translationUrl: string,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: { functional?: boolean; status?: string };
      };
      return payload.data?.functional === true && payload.data.status === 'available';
    }
    if (response.status !== 404) return false;

    const fallback = await fetch(translationUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Operational check',
        sourceLanguage: 'en',
        targetLanguage: 'de',
      }),
      signal: controller.signal,
    });
    if (!fallback.ok) return false;
    const payload = (await fallback.json()) as {
      data?: { available?: boolean; provider?: string; text?: string };
    };
    return (
      payload.data?.available === true &&
      payload.data.provider === 'openai' &&
      Boolean(payload.data.text?.trim()) &&
      payload.data.text?.trim().toLocaleLowerCase() !== 'operational check'
    );
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
