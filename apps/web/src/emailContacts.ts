export interface EmailContact {
  id: string;
  label: string;
  email: string;
  category: string;
}

export const emailContacts: EmailContact[] = [
  {
    id: 'dispatch',
    label: 'Dispecerat',
    email: 'dispatch@example.com',
    category: 'Transport',
  },
  {
    id: 'customer-service',
    label: 'Client / Service clienti',
    email: 'customer@example.com',
    category: 'Clienti',
  },
  {
    id: 'employer',
    label: 'Angajator / Firma',
    email: 'office@example.com',
    category: 'Firma',
  },
  {
    id: 'vehicle-service',
    label: 'Service auto',
    email: 'service@example.com',
    category: 'Service',
  },
  {
    id: 'platform-support',
    label: 'Suport platforma',
    email: 'support@example.com',
    category: 'Platforma',
  },
];
