export interface EmailContact {
  id: string;
  email: string;
}

export const emailContacts: EmailContact[] = [
  {
    id: 'dispatch',
    email: 'dispatch@example.com',
  },
  {
    id: 'customer-service',
    email: 'customer@example.com',
  },
  {
    id: 'employer',
    email: 'office@example.com',
  },
  {
    id: 'vehicle-service',
    email: 'service@example.com',
  },
  {
    id: 'platform-support',
    email: 'support@example.com',
  },
];
