export const MACHINE_AUTH_CONTRACT = {
  version: 'm2m-client-credentials.v1',
  issuer: 'https://api.agmcockpit.com',
  audience: 'agm:authority-control-plane',
  scope: 'acp:read',
  tokenUse: 'machine_access',
  accessTokenExpiresInSeconds: 300,
  defaultCredentialLifetimeDays: 90,
  maximumCredentialLifetimeDays: 365,
  activeIdentityStatus: 'ACTIVE',
  provisioningRoles: ['company_owner', 'OWNER', 'PRODUCT_OWNER', 'COMPANY_OWNER', 'ADMIN'],
} as const;

export interface MachineJwtPayload {
  sub: string;
  companyId: string;
  client_id: string;
  credential_id: string;
  scope: string;
  token_use: string;
  iss?: string;
  aud?: string | string[];
}

export interface MachineRequestContext {
  requestId: string;
  correlationId: string;
  companyId: string;
  subject: string;
  machineIdentityId: string;
  credentialId: string;
  scopes: string[];
}
