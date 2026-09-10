type PremiumShellOptions = {
  viewClass: string;
  labelledBy: string;
  brandHref: string;
  brandModule: 'home' | 'premium';
  brandAriaLabel: string;
  navigation: string;
  content: string;
  footer: string;
};

export function renderPremiumShell(options: PremiumShellOptions) {
  const logoUrl = `${import.meta.env?.BASE_URL ?? '/'}images/images/logo1.png`;

  return `
    <section class="${options.viewClass}" aria-labelledby="${options.labelledBy}">
      <header class="premium-topbar">
        <a href="${options.brandHref}" data-module="${options.brandModule}" class="premium-brand" aria-label="${options.brandAriaLabel}">
          <img src="${logoUrl}" alt="AGM" />
          <strong>AGM</strong>
          <span>Premium</span>
        </a>
        ${options.navigation}
      </header>

      ${options.content}

      <footer class="premium-footer${options.viewClass === 'premium-team-view' ? ' premium-team-footer' : ''}">
        ${options.footer}
      </footer>
    </section>
  `;
}
