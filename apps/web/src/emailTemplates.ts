import { type LanguageCode } from './emailLanguage';

export type MessageCategory = 'transport' | 'clients' | 'logistics' | 'documents' | 'emergencies';

export interface EmailTemplateContent {
  subject: string;
  message: string;
}

export interface EmailTemplate {
  id: string;
  category: MessageCategory;
  variables: string[];
  subject: string;
  message: string;
  translations: Record<LanguageCode, EmailTemplateContent>;
}

type LocalizedContent = Record<LanguageCode, [subject: string, message: string]>;

function template(id: string, category: MessageCategory, variables: string[], content: LocalizedContent): EmailTemplate {
  return {
    id,
    category,
    variables,
    subject: content.ro[0],
    message: content.ro[1],
    translations: {
      ro: { subject: content.ro[0], message: content.ro[1] },
      de: { subject: content.de[0], message: content.de[1] },
      en: { subject: content.en[0], message: content.en[1] },
    },
  };
}

export const messageCategories: MessageCategory[] = ['transport', 'clients', 'logistics', 'documents', 'emergencies'];

export const emailTemplates: EmailTemplate[] = [
  template('offer', 'transport', ['vehicle', 'price'], {
    ro: ['Ofertă transport vehicul', 'Vă transmit oferta pentru transportul vehiculului {{vehicle}}, în valoare de {{price}}. Vă rog să confirmați dacă putem continua programarea.'],
    de: ['Angebot für Fahrzeugtransport', 'Gerne sende ich Ihnen das Angebot für den Transport des Fahrzeugs {{vehicle}} zum Preis von {{price}}. Bitte bestätigen Sie, ob wir die Planung fortsetzen können.'],
    en: ['Vehicle transport offer', 'I am sending you the offer for transporting vehicle {{vehicle}} at a price of {{price}}. Please confirm whether we may proceed with scheduling.'],
  }),
  template('pickup-confirmation', 'transport', ['vehicle', 'location', 'date', 'time'], {
    ro: ['Confirmare preluare vehicul', 'Confirm preluarea vehiculului {{vehicle}} din {{location}}, la data de {{date}}, ora {{time}}.'],
    de: ['Bestätigung der Fahrzeugabholung', 'Ich bestätige die Abholung des Fahrzeugs {{vehicle}} in {{location}} am {{date}} um {{time}} Uhr.'],
    en: ['Vehicle pickup confirmation', 'I confirm the pickup of vehicle {{vehicle}} from {{location}} on {{date}} at {{time}}.'],
  }),
  template('delivery-confirmation', 'transport', ['vehicle', 'location', 'date', 'time'], {
    ro: ['Confirmare livrare vehicul', 'Confirm livrarea vehiculului {{vehicle}} la {{location}}, în data de {{date}}, la ora {{time}}.'],
    de: ['Bestätigung der Fahrzeuglieferung', 'Ich bestätige die Lieferung des Fahrzeugs {{vehicle}} nach {{location}} am {{date}} um {{time}} Uhr.'],
    en: ['Vehicle delivery confirmation', 'I confirm delivery of vehicle {{vehicle}} to {{location}} on {{date}} at {{time}}.'],
  }),
  template('vehicle-ready', 'transport', ['vehicle', 'location'], {
    ro: ['Vehicul pregătit pentru preluare', 'Vehiculul {{vehicle}} este pregătit pentru preluare la {{location}}.'],
    de: ['Fahrzeug abholbereit', 'Das Fahrzeug {{vehicle}} steht in {{location}} zur Abholung bereit.'],
    en: ['Vehicle ready for pickup', 'Vehicle {{vehicle}} is ready for pickup at {{location}}.'],
  }),
  template('missing-transport-documents', 'transport', ['transportNumber'], {
    ro: ['Documente lipsă pentru transport', 'Pentru transportul {{transportNumber}} lipsesc documente necesare. Vă rog să ni le transmiteți pentru a putea continua.'],
    de: ['Fehlende Transportunterlagen', 'Für den Transport {{transportNumber}} fehlen erforderliche Unterlagen. Bitte senden Sie uns diese, damit wir fortfahren können.'],
    en: ['Missing transport documents', 'Required documents are missing for transport {{transportNumber}}. Please send them so that we can proceed.'],
  }),
  template('delay-notice', 'transport', ['transportNumber', 'time'], {
    ro: ['Întârziere transport', 'Transportul {{transportNumber}} va întârzia. Ora estimată actualizată este {{time}}. Vă mulțumesc pentru înțelegere.'],
    de: ['Transportverspätung', 'Der Transport {{transportNumber}} verspätet sich. Die aktualisierte voraussichtliche Ankunftszeit ist {{time}} Uhr. Vielen Dank für Ihr Verständnis.'],
    en: ['Transport delay', 'Transport {{transportNumber}} is delayed. The updated estimated arrival time is {{time}}. Thank you for your understanding.'],
  }),
  template('schedule-change', 'transport', ['transportNumber', 'date', 'time'], {
    ro: ['Modificare program transport', 'Programul transportului {{transportNumber}} s-a modificat pentru {{date}}, ora {{time}}. Vă rog să confirmați disponibilitatea.'],
    de: ['Änderung des Transportplans', 'Der Zeitplan für Transport {{transportNumber}} wurde auf den {{date}} um {{time}} Uhr geändert. Bitte bestätigen Sie Ihre Verfügbarkeit.'],
    en: ['Transport schedule change', 'The schedule for transport {{transportNumber}} has changed to {{date}} at {{time}}. Please confirm your availability.'],
  }),
  template('thank-you', 'clients', ['recipientName'], {
    ro: ['Mulțumire pentru colaborare', 'Vă mulțumesc, {{recipientName}}, pentru colaborare. Rămân disponibil pentru orice informație suplimentară.'],
    de: ['Vielen Dank für die Zusammenarbeit', 'Vielen Dank, {{recipientName}}, für die Zusammenarbeit. Für weitere Informationen stehe ich Ihnen gerne zur Verfügung.'],
    en: ['Thank you for your cooperation', 'Thank you, {{recipientName}}, for your cooperation. I remain available for any further information.'],
  }),
  template('information-request', 'clients', ['recipientName', 'transportNumber'], {
    ro: ['Cerere de informații', 'Vă rog, {{recipientName}}, să îmi transmiteți informațiile actualizate pentru transportul {{transportNumber}}.'],
    de: ['Informationsanfrage', 'Bitte senden Sie mir, {{recipientName}}, die aktuellen Informationen zum Transport {{transportNumber}}.'],
    en: ['Request for information', 'Please send me, {{recipientName}}, the latest information for transport {{transportNumber}}.'],
  }),
  template('order-confirmation', 'clients', ['transportNumber', 'date'], {
    ro: ['Confirmare comandă', 'Confirmăm comanda pentru transportul {{transportNumber}}, programat pentru {{date}}.'],
    de: ['Auftragsbestätigung', 'Wir bestätigen den Auftrag für Transport {{transportNumber}}, geplant für den {{date}}.'],
    en: ['Order confirmation', 'We confirm the order for transport {{transportNumber}}, scheduled for {{date}}.'],
  }),
  template('feedback-request', 'clients', ['transportNumber'], {
    ro: ['Solicitare feedback', 'Vă rugăm să ne transmiteți feedbackul dumneavoastră privind transportul {{transportNumber}}. Opinia dumneavoastră ne ajută să îmbunătățim serviciile.'],
    de: ['Bitte um Rückmeldung', 'Bitte geben Sie uns eine Rückmeldung zum Transport {{transportNumber}}. Ihre Meinung hilft uns, unseren Service zu verbessern.'],
    en: ['Feedback request', 'Please share your feedback regarding transport {{transportNumber}}. Your opinion helps us improve our service.'],
  }),
  template('loading-confirmation', 'logistics', ['vehicle', 'location', 'time'], {
    ro: ['Confirmare încărcare', 'Confirm încărcarea vehiculului {{vehicle}} la {{location}}, ora {{time}}.'],
    de: ['Bestätigung der Verladung', 'Ich bestätige die Verladung des Fahrzeugs {{vehicle}} in {{location}} um {{time}} Uhr.'],
    en: ['Loading confirmation', 'I confirm loading vehicle {{vehicle}} at {{location}} at {{time}}.'],
  }),
  template('unloading-confirmation', 'logistics', ['vehicle', 'location', 'time'], {
    ro: ['Confirmare descărcare', 'Confirm descărcarea vehiculului {{vehicle}} la {{location}}, ora {{time}}.'],
    de: ['Bestätigung der Entladung', 'Ich bestätige die Entladung des Fahrzeugs {{vehicle}} in {{location}} um {{time}} Uhr.'],
    en: ['Unloading confirmation', 'I confirm unloading vehicle {{vehicle}} at {{location}} at {{time}}.'],
  }),
  template('loading-problem', 'logistics', ['vehicle', 'location', 'details'], {
    ro: ['Problemă la încărcare', 'La încărcarea vehiculului {{vehicle}} în {{location}} a apărut următoarea problemă: {{details}}. Vă rog să indicați cum procedăm.'],
    de: ['Problem bei der Verladung', 'Bei der Verladung des Fahrzeugs {{vehicle}} in {{location}} ist folgendes Problem aufgetreten: {{details}}. Bitte teilen Sie uns das weitere Vorgehen mit.'],
    en: ['Loading problem', 'The following problem occurred while loading vehicle {{vehicle}} at {{location}}: {{details}}. Please advise how we should proceed.'],
  }),
  template('unloading-problem', 'logistics', ['vehicle', 'location', 'details'], {
    ro: ['Problemă la descărcare', 'La descărcarea vehiculului {{vehicle}} în {{location}} a apărut următoarea problemă: {{details}}. Vă rog să indicați cum procedăm.'],
    de: ['Problem bei der Entladung', 'Bei der Entladung des Fahrzeugs {{vehicle}} in {{location}} ist folgendes Problem aufgetreten: {{details}}. Bitte teilen Sie uns das weitere Vorgehen mit.'],
    en: ['Unloading problem', 'The following problem occurred while unloading vehicle {{vehicle}} at {{location}}: {{details}}. Please advise how we should proceed.'],
  }),
  template('cmr-request', 'documents', ['transportNumber'], {
    ro: ['Solicitare CMR', 'Vă rog să transmiteți documentul CMR pentru transportul {{transportNumber}}.'],
    de: ['CMR-Anforderung', 'Bitte senden Sie den CMR-Frachtbrief für Transport {{transportNumber}}.'],
    en: ['CMR request', 'Please send the CMR document for transport {{transportNumber}}.'],
  }),
  template('invoice-request', 'documents', ['invoiceNumber', 'transportNumber'], {
    ro: ['Solicitare factură', 'Vă rog să transmiteți factura {{invoiceNumber}} aferentă transportului {{transportNumber}}.'],
    de: ['Rechnungsanforderung', 'Bitte senden Sie die Rechnung {{invoiceNumber}} für Transport {{transportNumber}}.'],
    en: ['Invoice request', 'Please send invoice {{invoiceNumber}} for transport {{transportNumber}}.'],
  }),
  template('proof-of-delivery', 'documents', ['transportNumber'], {
    ro: ['Dovadă de livrare', 'Vă transmit dovada de livrare pentru transportul {{transportNumber}}.'],
    de: ['Liefernachweis', 'Anbei erhalten Sie den Liefernachweis für Transport {{transportNumber}}.'],
    en: ['Proof of delivery', 'Please find the proof of delivery for transport {{transportNumber}}.'],
  }),
  template('missing-documents', 'documents', ['documentName', 'transportNumber'], {
    ro: ['Acte lipsă', 'Documentul {{documentName}} lipsește pentru transportul {{transportNumber}}. Vă rog să îl transmiteți cât mai curând.'],
    de: ['Fehlende Unterlagen', 'Das Dokument {{documentName}} fehlt für Transport {{transportNumber}}. Bitte senden Sie es so bald wie möglich.'],
    en: ['Missing documents', 'Document {{documentName}} is missing for transport {{transportNumber}}. Please send it as soon as possible.'],
  }),
  template('breakdown', 'emergencies', ['location', 'details'], {
    ro: ['Defecțiune vehicul', 'Vehiculul este imobilizat în {{location}} din cauza unei defecțiuni: {{details}}. Vă rog să organizați asistență.'],
    de: ['Fahrzeugpanne', 'Das Fahrzeug ist in {{location}} wegen einer Panne nicht fahrbereit: {{details}}. Bitte organisieren Sie Unterstützung.'],
    en: ['Vehicle breakdown', 'The vehicle is immobilized at {{location}} due to a breakdown: {{details}}. Please arrange assistance.'],
  }),
  template('accident', 'emergencies', ['location', 'details'], {
    ro: ['Accident', 'A avut loc un accident în {{location}}. Situația actuală: {{details}}. Voi transmite imediat informații suplimentare.'],
    de: ['Unfallmeldung', 'In {{location}} hat sich ein Unfall ereignet. Aktueller Stand: {{details}}. Weitere Informationen folgen umgehend.'],
    en: ['Accident report', 'An accident occurred at {{location}}. Current situation: {{details}}. I will provide further information immediately.'],
  }),
  template('major-delay', 'emergencies', ['transportNumber', 'time', 'details'], {
    ro: ['Întârziere majoră', 'Transportul {{transportNumber}} are o întârziere majoră. Noua estimare este {{time}}. Cauza: {{details}}.'],
    de: ['Erhebliche Verspätung', 'Transport {{transportNumber}} hat eine erhebliche Verspätung. Die neue Schätzung ist {{time}} Uhr. Ursache: {{details}}.'],
    en: ['Major delay', 'Transport {{transportNumber}} has a major delay. The new estimate is {{time}}. Cause: {{details}}.'],
  }),
  template('blocked-route', 'emergencies', ['location', 'details'], {
    ro: ['Rută blocată', 'Ruta este blocată în zona {{location}}: {{details}}. Verific o rută alternativă și revin cu ora estimată.'],
    de: ['Gesperrte Route', 'Die Route ist im Bereich {{location}} gesperrt: {{details}}. Ich prüfe eine Alternative und melde die neue Ankunftszeit.'],
    en: ['Blocked route', 'The route is blocked near {{location}}: {{details}}. I am checking an alternative route and will provide a new arrival estimate.'],
  }),
];

export function templateContent(item: EmailTemplate, language: LanguageCode): EmailTemplateContent {
  return item.translations[language];
}

export function fillTemplateVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([a-zA-Z]+)\}\}/g, (placeholder, key: string) => values[key]?.trim() || placeholder);
}
