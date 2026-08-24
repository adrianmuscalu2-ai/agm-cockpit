import type { BasicLanguageCode } from './language-registry';
import { renderPremiumGovernanceDashboard } from './premium-governance/premium-governance.view';

type PremiumTranslator = (key: string) => string;

export function renderPremiumFoundation(
  translate: PremiumTranslator,
  escapeHtml: (value: string) => string,
  _language: BasicLanguageCode = 'ro',
) {
  return renderPremiumGovernanceDashboard(translate, escapeHtml);
}
