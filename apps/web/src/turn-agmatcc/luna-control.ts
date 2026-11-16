type Control = { contract: string; configurationReady: boolean; checks: Record<string, boolean> };
const labels: Record<string, string> = { enabled: 'activarea autorizată', providerConfigured: 'providerul',
  ledgerAvailable: 'registrul bugetar', commanderBound: 'asocierea acestei sesiuni Commander',
  targetPinned: 'ținta Production', handoffPinned: 'transferul bugetului existent' };

/** A read-only diagnostic before a paid request; server authorization remains authoritative. */
export async function requireLunaConfiguration(fetcher: (path: string, init: RequestInit) => Promise<Response>) {
  const response = await fetcher('/agmatcc-copilot/control-status', { method: 'GET', cache: 'no-store' });
  if (response.status === 401) throw new Error('Sesiunea TURN lipsește sau a expirat. Reautentifică sesiunea TURN.');
  if (response.status === 403) throw new Error('Această sesiune nu are acces Commander la controlul Luna.');
  if (!response.ok) throw new Error(`Starea Luna nu poate fi verificată (HTTP ${response.status}).`);
  const status = (await response.json() as { data?: Control }).data;
  if (status?.contract !== 'luna-control-status.v1' || !status.checks || typeof status.configurationReady !== 'boolean') {
    throw new Error('Starea Luna nu poate fi verificată: contract invalid.');
  }
  const missing = Object.keys(labels).filter(key => status.checks[key] !== true);
  if (!status.configurationReady || missing.length) {
    throw new Error(`Luna nu este pregătită: ${missing.map(key => labels[key]).join(', ') || 'configurație incompletă'}. Nu s-a solicitat un răspuns plătit.`);
  }
}
