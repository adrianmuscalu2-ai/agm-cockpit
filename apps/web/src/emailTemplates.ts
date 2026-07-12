export interface EmailTemplate {
  id: string;
  subject: string;
  message: string;
  translations?: Partial<Record<'ro' | 'de' | 'en', EmailTemplateContent>>;
}

export interface EmailTemplateContent {
  subject: string;
  message: string;
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'general-manual',
    subject: '',
    message: '',
  },
  {
    id: 'offer',
    subject: 'Oferta transport vehicul',
    message: 'Va transmit oferta pentru transportul vehiculului. Va rog sa imi confirmati daca doriti sa continuam cu programarea.',
    translations: {
      de: {
        subject: 'Angebot fuer Fahrzeugtransport',
        message: 'Ich sende Ihnen das Angebot fuer den Fahrzeugtransport. Bitte bestaetigen Sie mir, ob wir mit der Planung fortfahren sollen.',
      },
      en: {
        subject: 'Vehicle transport offer',
        message: 'I am sending you the offer for the vehicle transport. Please confirm if you would like us to continue with the scheduling.',
      },
    },
  },
  {
    id: 'pickup-arrival',
    subject: 'Confirmare sosire la locatie',
    message: 'Am ajuns la locatie pentru preluarea vehiculului.',
    translations: {
      de: {
        subject: 'Ankunft am Abholort',
        message: 'Ich bin am Standort fuer die Abholung des Fahrzeugs angekommen.',
      },
      en: {
        subject: 'Arrival at pickup location',
        message: 'I have arrived at the pickup location for the vehicle.',
      },
    },
  },
  {
    id: 'delivery-confirmation',
    subject: 'Confirmare livrare vehicul',
    message: 'Confirm livrarea vehiculului la destinatie.',
    translations: {
      de: {
        subject: 'Bestaetigung der Fahrzeuglieferung',
        message: 'Ich bestaetige die Lieferung des Fahrzeugs am Zielort.',
      },
      en: {
        subject: 'Vehicle delivery confirmation',
        message: 'I confirm the delivery of the vehicle at the destination.',
      },
    },
  },
  {
    id: 'delay-notice',
    subject: 'Actualizare ora sosire',
    message: 'Transportul va intarzia. Va transmit o actualizare imediat ce am o ora estimata mai exacta.',
    translations: {
      de: {
        subject: 'Aktualisierung der Ankunftszeit',
        message: 'Der Transport wird sich verspaeten. Ich sende Ihnen eine Aktualisierung, sobald ich eine genauere voraussichtliche Ankunftszeit habe.',
      },
      en: {
        subject: 'Arrival time update',
        message: 'The transport will be delayed. I will send you an update as soon as I have a more accurate estimated arrival time.',
      },
    },
  },
  {
    id: 'missing-documents',
    subject: 'Documente necesare pentru transport',
    message: 'Va rog sa trimiteti documentele necesare pentru continuarea transportului.',
    translations: {
      de: {
        subject: 'Erforderliche Dokumente fuer den Transport',
        message: 'Bitte senden Sie mir die erforderlichen Dokumente, damit der Transport fortgesetzt werden kann.',
      },
      en: {
        subject: 'Required documents for transport',
        message: 'Please send me the required documents so the transport can continue.',
      },
    },
  },
  {
    id: 'thank-you',
    subject: 'Multumesc pentru colaborare',
    message: 'Va multumesc pentru colaborare. Raman disponibil pentru orice informatie suplimentara.',
    translations: {
      de: {
        subject: 'Vielen Dank fuer die Zusammenarbeit',
        message: 'Vielen Dank fuer die Zusammenarbeit. Ich stehe Ihnen fuer weitere Informationen gerne zur Verfuegung.',
      },
      en: {
        subject: 'Thank you for your cooperation',
        message: 'Thank you for your cooperation. I remain available for any further information.',
      },
    },
  },
  {
    id: 'vehicle-ready',
    subject: 'Vehicul pregatit pentru preluare',
    message: 'Vehiculul este pregatit pentru preluare.',
    translations: {
      de: {
        subject: 'Fahrzeug bereit zur Abholung',
        message: 'Das Fahrzeug ist fuer die Abholung bereit.',
      },
      en: {
        subject: 'Vehicle ready for pickup',
        message: 'The vehicle is ready for pickup.',
      },
    },
  },
];
