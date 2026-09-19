import type { BasicLanguageCode } from '../language-registry';
import type { PersonalContactVoiceResolution } from './personal-contact-voice';

type HandledResolution = Extract<PersonalContactVoiceResolution, { handled: true }>;

export function personalContactVoiceMessage(result: HandledResolution, language: BasicLanguageCode) {
  const name = result.contact?.name.trim() || result.requestedName;
  if (result.reason === 'AGM_PERSONAL_CONTACT_NEGATED_ACTION') {
    if (language === 'ro') return `Am identificat contactul ${name}. Nu am inițiat nicio acțiune.`;
    if (language === 'de') return `Ich habe den Kontakt ${name} erkannt. Es wurde keine Aktion gestartet.`;
    return `I identified ${name}. No action was started.`;
  }
  if (result.reason === 'AGM_PERSONAL_CONTACT_IDENTITY_AMBIGUOUS') {
    if (language === 'ro') return `Am găsit mai multe contacte compatibile cu numele ${name}. Pe care îl dorești?`;
    if (language === 'de') return `Ich habe mehrere passende Kontakte für ${name} gefunden. Welchen meinst du?`;
    return `I found multiple contacts matching ${name}. Which one do you mean?`;
  }
  if (result.reason === 'AGM_PERSONAL_CONTACT_ACTION_REQUIRED') {
    if (language === 'ro') return `Am găsit ${name} în Contacte personale AGM. Ce vrei să folosesc: telefon, apel, Gmail, Messenger sau WhatsApp?`;
    if (language === 'de') return `Ich habe ${name} in den persönlichen AGM-Kontakten gefunden. Was möchtest du verwenden: Telefon, Anruf, Gmail, Messenger oder WhatsApp?`;
    return `I found ${name} in AGM Personal Contacts. What should I use: phone, call, Gmail, Messenger, or WhatsApp?`;
  }
  if (result.reason === 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING') {
    const channel = result.requestedChannel === 'EMAIL' ? 'Gmail' : result.requestedChannel === 'MESSENGER' ? 'Messenger' : result.requestedChannel === 'WHATSAPP' ? 'WhatsApp' : language === 'ro' ? 'telefon' : 'phone';
    if (language === 'ro') return `${name} nu are un canal ${channel} salvat în Contacte personale AGM.`;
    if (language === 'de') return `${name} hat keinen gespeicherten ${channel}-Kanal in den persönlichen AGM-Kontakten.`;
    return `${name} does not have a saved ${channel} channel in AGM Personal Contacts.`;
  }

  const contact = result.contact!;
  const source = language === 'ro' ? 'Contacte personale AGM' : language === 'de' ? 'Persönliche AGM-Kontakte' : 'AGM Personal Contacts';
  const sourceLabel = language === 'ro' ? 'Sursă' : language === 'de' ? 'Quelle' : 'Source';
  const selected = language === 'ro' ? `Contact selectat: ${contact.name}` : language === 'de' ? `Ausgewählter Kontakt: ${contact.name}` : `Selected contact: ${contact.name}`;
  if (result.intent === 'PHONE') return `${selected}\n${language === 'ro' ? 'Număr' : language === 'de' ? 'Nummer' : 'Number'}: ${contact.phone.trim()}\n${sourceLabel}: ${source}`;
  if (result.intent === 'EMAIL') return `${selected}\nEmail: ${contact.email.trim()}\n${sourceLabel}: ${source}`;
  if (result.intent === 'MESSENGER') return `${selected}\nMessenger: ${contact.messenger.trim()}\n${sourceLabel}: ${source}`;
  if (result.intent === 'WHATSAPP') return `${selected}\nWhatsApp: ${contact.whatsapp.trim()}\n${sourceLabel}: ${source}`;
  const rows = [selected];
  if (contact.phone.trim()) rows.push(`${language === 'ro' ? 'Telefon' : 'Phone'}: ${contact.phone.trim()}`);
  if (contact.email.trim()) rows.push(`Email: ${contact.email.trim()}`);
  if (contact.messenger.trim()) rows.push(`Messenger: ${contact.messenger.trim()}`);
  if (contact.whatsapp.trim()) rows.push(`WhatsApp: ${contact.whatsapp.trim()}`);
  rows.push(`${sourceLabel}: ${source}`);
  return rows.join('\n');
}
