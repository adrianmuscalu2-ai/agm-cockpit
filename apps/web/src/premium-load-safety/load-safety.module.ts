export const loadSafetyModule = {
  id: 'ladungssicherung-assistant',
  enabled: true,
  route: '/premium/ladungssicherung',
  accepts: ['image/jpeg', 'image/png', 'image/webp'],
  maxImageBytes: 8 * 1024 * 1024,
  storesImages: false,
  categories: ['correct', 'recommendations', 'risks'],
} as const;
