import type { BasicLanguageCode } from './language-registry';
import { renderPremiumUserDashboard } from './premium-governance/premium-governance.view';

type PremiumTranslator = (key: string) => string;

export function renderPremiumFoundation(
  translate: PremiumTranslator,
  escapeHtml: (value: string) => string,
  _language: BasicLanguageCode = 'ro',
) {
  return renderPremiumUserDashboard(translate, escapeHtml);
}
