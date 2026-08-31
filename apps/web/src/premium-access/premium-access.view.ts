import type { BasicLanguageCode } from '../language-registry';
type AccessLanguage = BasicLanguageCode;

const copy = {
  ro: {
    eyebrow: 'AGM · ACCES', title: 'Acces și abonament',
    description: 'Aici verifici dreptul de acces. Instrumentele Premium rămân într-un spațiu operațional separat.',
    basic: 'AGM Basic', basicBody: 'Funcțiile esențiale rămân disponibile independent de Premium.',
    premium: 'AGM Premium', premiumBody: 'Instrumentele avansate sunt disponibile numai după validarea entitlement-ului.',
    status: 'Autentificați-vă pentru verificarea accesului Premium.',
    openBasic: 'Deschide Basic', openPremium: 'Vezi Premium', back: 'Înapoi',
    login: 'Autentificare', email: 'E-mail', password: 'Parolă', remember: 'Ține-mă minte',
    showPassword: 'Arată parola', verify: 'Verifică accesul', logout: 'Închide sesiunea',
  },
  de: {
    eyebrow: 'AGM · ZUGANG', title: 'Zugang und Abonnement',
    description: 'Hier wird die Zugangsberechtigung geprüft. Premium-Werkzeuge bleiben in einem getrennten Arbeitsbereich.',
    basic: 'AGM Basic', basicBody: 'Die wesentlichen Funktionen bleiben unabhängig von Premium verfügbar.',
    premium: 'AGM Premium', premiumBody: 'Erweiterte Werkzeuge sind erst nach gültiger Berechtigungsprüfung verfügbar.',
    status: 'Melden Sie sich an, um den Premium-Zugang zu prüfen.',
    openBasic: 'Basic öffnen', openPremium: 'Premium ansehen', back: 'Zurück',
    login: 'Anmeldung', email: 'E-Mail', password: 'Passwort', remember: 'Angemeldet bleiben',
    showPassword: 'Passwort anzeigen', verify: 'Zugang prüfen', logout: 'Abmelden',
  },
  en: {
    eyebrow: 'AGM · ACCESS', title: 'Access and subscription',
    description: 'Access rights are verified here. Premium tools remain in a separate operational workspace.',
    basic: 'AGM Basic', basicBody: 'Essential functions remain available independently of Premium.',
    premium: 'AGM Premium', premiumBody: 'Advanced tools are available only after entitlement validation.',
    status: 'Sign in to verify Premium access.',
    openBasic: 'Open Basic', openPremium: 'View Premium', back: 'Back',
    login: 'Sign in', email: 'Email', password: 'Password', remember: 'Keep me signed in',
    showPassword: 'Show password', verify: 'Verify access', logout: 'Sign out',
  },
  it: { eyebrow:'AGM · ACCESSO',title:'Accesso e abbonamento',description:'Qui vengono verificati i diritti di accesso. Gli strumenti Premium restano in uno spazio operativo separato.',basic:'AGM Basic',basicBody:'Le funzioni essenziali restano disponibili indipendentemente da Premium.',premium:'AGM Premium',premiumBody:'Gli strumenti avanzati sono disponibili solo dopo la convalida del diritto di accesso.',status:'Accedi per verificare l’accesso Premium.',openBasic:'Apri Basic',openPremium:'Visualizza Premium',back:'Indietro',login:'Accedi',email:'E-mail',password:'Password',remember:'Resta connesso',showPassword:'Mostra password',verify:'Verifica accesso',logout:'Esci' },
  es: { eyebrow:'AGM · ACCESO',title:'Acceso y suscripción',description:'Aquí se verifican los derechos de acceso. Las herramientas Premium permanecen en un espacio operativo separado.',basic:'AGM Basic',basicBody:'Las funciones esenciales siguen disponibles independientemente de Premium.',premium:'AGM Premium',premiumBody:'Las herramientas avanzadas solo están disponibles tras validar el derecho de acceso.',status:'Inicia sesión para verificar el acceso Premium.',openBasic:'Abrir Basic',openPremium:'Ver Premium',back:'Atrás',login:'Iniciar sesión',email:'Correo electrónico',password:'Contraseña',remember:'Mantener la sesión iniciada',showPassword:'Mostrar contraseña',verify:'Verificar acceso',logout:'Cerrar sesión' },
  sv: { eyebrow:'AGM · ÅTKOMST',title:'Åtkomst och abonnemang',description:'Här verifieras åtkomsträttigheter. Premium-verktygen finns kvar i en separat operativ arbetsyta.',basic:'AGM Basic',basicBody:'Grundläggande funktioner är tillgängliga oberoende av Premium.',premium:'AGM Premium',premiumBody:'Avancerade verktyg är tillgängliga först efter att behörigheten har validerats.',status:'Logga in för att verifiera Premium-åtkomst.',openBasic:'Öppna Basic',openPremium:'Visa Premium',back:'Tillbaka',login:'Logga in',email:'E-post',password:'Lösenord',remember:'Håll mig inloggad',showPassword:'Visa lösenord',verify:'Verifiera åtkomst',logout:'Logga ut' },
} as const;

export function renderPremiumAccessView(language: AccessLanguage, escapeHtml: (value: string) => string) {
  const text = language in copy ? copy[language as keyof typeof copy] : copy.en;
  return `<section class="premium-view premium-access-view" aria-labelledby="access-title" data-access-enforcement="session" data-access-state="checking">
    <header class="premium-topbar">
      <a href="/" data-module="home" class="premium-brand" aria-label="${escapeHtml(text.back)}"><strong>AGM</strong><span>${escapeHtml(text.eyebrow)}</span></a>
      <a href="/" data-module="home" class="premium-back">${escapeHtml(text.back)}</a>
    </header>
    <div class="premium-intro">
      <span>${escapeHtml(text.eyebrow)}</span><h1 id="access-title">${escapeHtml(text.title)}</h1>
      <p>${escapeHtml(text.description)}</p>
    </div>
    <div class="premium-modules" aria-label="${escapeHtml(text.title)}">
      <article class="premium-module"><span class="premium-module-marker" aria-hidden="true">B</span><div class="premium-module-content">
        <h2>${escapeHtml(text.basic)}</h2><p>${escapeHtml(text.basicBody)}</p>
        <a class="premium-module-action" href="/" data-module="home">${escapeHtml(text.openBasic)}</a>
      </div></article>
      <article class="premium-module"><span class="premium-module-marker" aria-hidden="true">P</span><div class="premium-module-content">
        <h2>${escapeHtml(text.premium)}</h2><p>${escapeHtml(text.premiumBody)}</p>
        <a class="premium-module-action" href="/premium" data-module="premium" data-access-premium-link hidden aria-disabled="true">${escapeHtml(text.openPremium)}</a>
      </div></article>
    </div>
    <form data-access-login class="premium-module" autocomplete="on">
      <div class="premium-module-content"><h2>${escapeHtml(text.login)}</h2>
        <label>${escapeHtml(text.email)} <input name="email" type="email" autocomplete="username" required /></label>
        <label>${escapeHtml(text.password)}
          <span class="premium-password-field"><input name="password" type="password" autocomplete="current-password" required /><button type="button" class="premium-password-toggle" data-password-toggle aria-pressed="false">${escapeHtml(text.showPassword)}</button></span>
        </label>
        <label class="premium-remember"><input name="remember" type="checkbox" data-access-remember /> <span>${escapeHtml(text.remember)}</span></label>
        <button class="premium-module-action" type="submit">${escapeHtml(text.verify)}</button>
        <button class="premium-back" type="button" data-access-logout>${escapeHtml(text.logout)}</button>
      </div>
    </form>
    <footer class="premium-footer"><p data-access-status aria-live="polite">${escapeHtml(text.status)}</p></footer>
  </section>`;
}
