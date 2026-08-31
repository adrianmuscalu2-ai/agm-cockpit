import type { BasicLanguageCode } from './language-registry';

export const DASHBOARD_WARNING_VISION_FLAG = 'VITE_DASHBOARD_WARNING_VISION_ENABLED';
export const DASHBOARD_WARNING_VISION_DEFAULT = false;

export function dashboardWarningVisionEnabled(value: unknown): boolean {
  return value === 'true';
}

const containmentCopy: Readonly<Record<BasicLanguageCode, { title: string; description: string; action: string }>> = {
  ro: { title: 'Martori în bord', description: 'Consultă catalogul cu explicații și recomandări generale. Pentru moment, identificarea automată din fotografie nu este disponibilă.', action: 'Deschide catalogul' },
  de: { title: 'Kontrollleuchten', description: 'Öffne den Katalog mit allgemeinen Erklärungen und Empfehlungen. Die automatische Erkennung aus einem Foto ist derzeit nicht verfügbar.', action: 'Katalog öffnen' },
  en: { title: 'Dashboard warning lights', description: 'Consult the catalog for general explanations and recommendations. Automatic identification from a photo is currently unavailable.', action: 'Open catalog' },
  fr: { title: 'Voyants du tableau de bord', description: 'Consultez le catalogue pour des explications et recommandations générales. L’identification automatique à partir d’une photo est actuellement indisponible.', action: 'Ouvrir le catalogue' },
  nl: { title: 'Dashboardwaarschuwingslampjes', description: 'Raadpleeg de catalogus voor algemene uitleg en aanbevelingen. Automatische identificatie vanaf een foto is momenteel niet beschikbaar.', action: 'Catalogus openen' },
  ru: { title: 'Контрольные лампы панели', description: 'Откройте каталог с общими пояснениями и рекомендациями. Автоматическое распознавание по фотографии сейчас недоступно.', action: 'Открыть каталог' },
  pl: { title: 'Kontrolki na desce rozdzielczej', description: 'Skorzystaj z katalogu ogólnych wyjaśnień i zaleceń. Automatyczne rozpoznawanie ze zdjęcia jest obecnie niedostępne.', action: 'Otwórz katalog' },
  tr: { title: 'Gösterge paneli uyarı ışıkları', description: 'Genel açıklamalar ve öneriler için kataloğu inceleyin. Fotoğraftan otomatik tanımlama şu anda kullanılamıyor.', action: 'Kataloğu aç' },
  sq: { title: 'Dritat paralajmëruese të panelit', description: 'Konsulto katalogun për shpjegime dhe rekomandime të përgjithshme. Identifikimi automatik nga fotografia aktualisht nuk është i disponueshëm.', action: 'Hap katalogun' },
  it: { title: 'Spie del cruscotto', description: 'Consulta il catalogo per spiegazioni e raccomandazioni generali. Il riconoscimento automatico da una foto non è attualmente disponibile.', action: 'Apri il catalogo' },
  es: { title: 'Testigos del salpicadero', description: 'Consulta el catálogo para obtener explicaciones y recomendaciones generales. La identificación automática mediante una foto no está disponible actualmente.', action: 'Abrir el catálogo' },
  sv: { title: 'Varningslampor på instrumentpanelen', description: 'Se katalogen för allmänna förklaringar och rekommendationer. Automatisk identifiering från ett foto är inte tillgänglig just nu.', action: 'Öppna katalogen' },
};

export function dashboardWarningContainmentCopy(language: BasicLanguageCode) {
  return containmentCopy[language];
}
