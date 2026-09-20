import type { BasicLanguageCode } from '../language-registry';
import type { PersonalContactVoiceResolution } from './personal-contact-voice';
import { normalizeContactEmails } from './contact-email';

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
  if (result.reason === 'AGM_PERSONAL_CONTACT_EMAIL_AMBIGUOUS') {
    return personalContactEmailChoicePrompt(name, result.availableEmailLabels ?? [], language);
  }
  if (result.reason === 'AGM_PERSONAL_CONTACT_EMAIL_LABEL_NOT_FOUND') {
    const available = emailLabels(result.availableEmailLabels ?? [], language);
    if (language === 'ro') return `${name} nu are o adresă ${result.requestedEmailLabel || 'cu eticheta cerută'}. Adrese disponibile: ${available}.`;
    if (language === 'de') return `${name} hat keine Adresse mit dem gewünschten Label. Verfügbar: ${available}.`;
    return `${name} does not have the requested labelled address. Available: ${available}.`;
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
  if (result.intent === 'EMAIL') {
    const email = result.selectedEmail;
    return `${selected}\nEmail${email?.label ? ` (${email.label})` : ''}: ${email?.value ?? contact.email.trim()}\n${sourceLabel}: ${source}`;
  }
  if (result.intent === 'MESSENGER') return `${selected}\nMessenger: ${contact.messenger.trim()}\n${sourceLabel}: ${source}`;
  if (result.intent === 'WHATSAPP') return `${selected}\nWhatsApp: ${contact.whatsapp.trim()}\n${sourceLabel}: ${source}`;
  const rows = [selected];
  if (contact.phone.trim()) rows.push(`${language === 'ro' ? 'Telefon' : 'Phone'}: ${contact.phone.trim()}`);
  for (const email of normalizeContactEmails(contact.emails, contact.email)) rows.push(`Email (${email.label}): ${email.value}${email.isDefault ? ' · default' : ''}`);
  if (contact.messenger.trim()) rows.push(`Messenger: ${contact.messenger.trim()}`);
  if (contact.whatsapp.trim()) rows.push(`WhatsApp: ${contact.whatsapp.trim()}`);
  rows.push(`${sourceLabel}: ${source}`);
  return rows.join('\n');
}

export function personalContactEmailChoicePrompt(name: string, labels: readonly string[], language: BasicLanguageCode) {
  const choices = emailLabels(labels, language);
  if (language === 'ro') return `Am găsit mai multe adrese pentru ${name}. Pe adresa ${choices}?`;
  if (language === 'de') return `Ich habe mehrere Adressen für ${name} gefunden. Welche soll ich verwenden: ${choices}?`;
  return `I found multiple addresses for ${name}. Which should I use: ${choices}?`;
}

function emailLabels(labels: readonly string[], language: BasicLanguageCode) {
  const values = labels.length ? [...new Set(labels)] : ['personal', 'work'];
  const localized = values.map((label) => {
    const key = label.toLocaleLowerCase();
    if (language === 'ro') return key === 'personal' ? 'personală' : key === 'work' ? 'de serviciu' : label;
    if (language === 'de') return key === 'personal' ? 'privat' : key === 'work' ? 'geschäftlich' : label;
    return key === 'personal' ? 'personal' : key === 'work' ? 'work' : label;
  });
  if (language === 'ro' && localized.length === 2) return localized.join(' sau ');
  return localized.join(', ');
}
