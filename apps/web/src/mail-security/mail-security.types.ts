export type MailSecurityStatus = 'safe' | 'blocked';

export interface MailSecurityCheck {
  status: MailSecurityStatus;
  messages: string[];
}
