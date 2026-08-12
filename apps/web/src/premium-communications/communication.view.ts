import { renderPremiumShell } from '../premium-shell';

export function renderCommunicationView() {
  return renderPremiumShell({
    viewClass: 'premium-communications-view',
    labelledBy: 'communications-title',
    brandHref: '/premium',
    brandModule: 'premium',
    brandAriaLabel: 'Înapoi la Premium',
    navigation: '<a href="/premium" data-module="premium" class="premium-back">Înapoi la Premium</a>',
    content: `<main data-premium-communications>
      <div class="premium-intro"><span>COMUNICARE</span><h1 id="communications-title">E-mail și WhatsApp</h1><p>Conversații operaționale asociate cursei active. Trimiterea este disponibilă numai când furnizorul este configurat.</p></div>
      <section class="premium-module"><form data-communication-compose>
        <label>Canal<select name="channel"><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label>
        <label>Destinatar<input name="to" required autocomplete="off" /></label>
        <label data-email-subject>Subiect<input name="subject" /></label>
        <label>Mesaj<textarea name="bodyText" required maxlength="20000"></textarea></label>
        <button type="submit">Trimite</button><p role="status" data-communication-status>Pregătit.</p>
      </form></section>
      <section class="premium-module"><div><button type="button" data-refresh-communications>Actualizează conversațiile</button></div><ol data-communication-list><li>Conversațiile nu au fost încă încărcate.</li></ol></section>
    </main>`,
    footer: '<span>AGM Premium · comunicare controlată · fără capacități simulate</span>',
  });
}
