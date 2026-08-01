export const loadSafetyModule = {
  id: 'ladungssicherung-assistant',
  enabled: true,
  route: '/premium/ladungssicherung',
  accepts: ['image/jpeg', 'image/png', 'image/webp'],
  maxImageBytes: 8 * 1024 * 1024,
  storesImages: false,
  categories: ['correct', 'recommendations', 'risks'],
} as const;

export function validateLoadSafetyImageFile(file: Pick<File, 'type' | 'size'>) {
  if (!loadSafetyModule.accepts.includes(file.type as (typeof loadSafetyModule.accepts)[number])) {
    return { valid: false, reason: 'invalid' } as const;
  }
  if (file.size > loadSafetyModule.maxImageBytes) {
    return { valid: false, reason: 'tooLarge' } as const;
  }
  return { valid: true } as const;
}
