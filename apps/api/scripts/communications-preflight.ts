import 'dotenv/config';

const required = {
  common: ['COMMUNICATION_COMPANY_ID'],
  gmail: ['GMAIL_FROM_ADDRESS', 'GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN', 'GMAIL_PUBSUB_VERIFICATION_TOKEN'],
  whatsapp: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
} as const;

let failed = false;
for (const [group, names] of Object.entries(required)) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  console.log(`${group.toUpperCase()} — ${missing.length ? `NOT CONFIGURED (${missing.join(', ')})` : 'CONFIGURED'}`);
  failed ||= missing.length > 0;
}
console.log('SECRETS — VALUES NOT PRINTED');
process.exitCode = failed ? 2 : 0;
