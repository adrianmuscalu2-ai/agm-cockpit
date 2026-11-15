export function canonicalAcpm(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonicalAcpm).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonicalAcpm(v)).join(',')+'}';
  return JSON.stringify(value);
}
