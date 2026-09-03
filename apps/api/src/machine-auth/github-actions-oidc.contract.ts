export const GITHUB_ACTIONS_PROVISIONING_CONTRACT = {
  issuer: 'https://token.actions.githubusercontent.com',
  jwksUri: 'https://token.actions.githubusercontent.com/.well-known/jwks',
  audience: 'agm:production-machine-provisioning',
  subject: 'repo:adrianmuscalu2-ai/agm-cockpit:environment:Production',
  repository: 'adrianmuscalu2-ai/agm-cockpit',
  repositoryId: '1291761011',
  repositoryOwnerId: '291890856',
  environment: 'Production',
  ref: 'refs/heads/agm-canonical-20260820',
  workflowRef: 'adrianmuscalu2-ai/agm-cockpit/.github/workflows/production-release.yml@refs/heads/agm-canonical-20260820',
  eventName: 'push',
  runnerEnvironment: 'github-hosted',
  role: 'DEPLOYMENT_PROVISIONER',
  maxTokenLifetimeSeconds: 600,
  clockToleranceSeconds: 30,
  jwksCacheMs: 300_000,
  jwksTimeoutMs: 5_000,
} as const;

export type GitHubActionsOidcClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  repository: string;
  repository_id: string;
  repository_owner_id: string;
  environment: string;
  ref: string;
  sha: string;
  workflow_ref: string;
  event_name: string;
  runner_environment: string;
  run_id: string;
  run_attempt: string;
};
