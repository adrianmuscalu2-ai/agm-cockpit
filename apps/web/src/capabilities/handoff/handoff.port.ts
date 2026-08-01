export type HandoffAttachment = {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
};

export type EmailHandoffRequest = {
  recipient: string;
  subject: string;
  body: string;
  attachments?: HandoffAttachment[];
};

export type ShareHandoffRequest = Omit<EmailHandoffRequest, 'recipient'>;

export interface HandoffPort {
  readonly platform: 'browser' | 'android';
  composeEmail(request: EmailHandoffRequest): Promise<void>;
  share(request: ShareHandoffRequest): Promise<void>;
}

