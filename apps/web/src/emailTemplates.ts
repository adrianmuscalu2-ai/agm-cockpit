export interface EmailTemplate {
  id: string;
  label: string;
  subject: string;
  message: string;
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'offer',
    label: 'Oferta transport',
    subject: 'Oferta transport vehicul',
    message: 'Va transmit oferta pentru transportul vehiculului. Va rog sa imi confirmati daca doriti sa continuam cu programarea.',
  },
  {
    id: 'pickup-arrival',
    label: 'Confirmare sosire la preluare',
    subject: 'Confirmare sosire la locatie',
    message: 'Am ajuns la locatie pentru preluarea vehiculului.',
  },
  {
    id: 'delivery-confirmation',
    label: 'Confirmare livrare',
    subject: 'Confirmare livrare vehicul',
    message: 'Confirm livrarea vehiculului la destinatie.',
  },
  {
    id: 'delay-notice',
    label: 'Anunt intarziere',
    subject: 'Actualizare ora sosire',
    message: 'Transportul va intarzia. Va transmit o actualizare imediat ce am o ora estimata mai exacta.',
  },
  {
    id: 'missing-documents',
    label: 'Documente lipsa',
    subject: 'Documente necesare pentru transport',
    message: 'Va rog sa trimiteti documentele necesare pentru continuarea transportului.',
  },
  {
    id: 'thank-you',
    label: 'Multumire',
    subject: 'Multumesc pentru colaborare',
    message: 'Va multumesc pentru colaborare. Raman disponibil pentru orice informatie suplimentara.',
  },
  {
    id: 'vehicle-ready',
    label: 'Vehicul pregatit',
    subject: 'Vehicul pregatit pentru preluare',
    message: 'Vehiculul este pregatit pentru preluare.',
  },
];
