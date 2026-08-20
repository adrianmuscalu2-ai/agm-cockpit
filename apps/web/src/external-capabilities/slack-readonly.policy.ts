export const AGM_SLACK_WORKSPACE_ID = 'T0BJBPRN24A' as const;

export const AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST = Object.freeze({
  'all-agm-transporte': 'C0BJ5HMBB35',
  development: 'C0BJ9R0Q13Q',
  documentation: 'C0BJDNJSGU9',
  general: 'C0BJ5HGQKLK',
  ideas: 'C0BJFGGL4TE',
  marketing: 'C0BJDMF01ND',
  testing: 'C0BJ9R1NPEJ',
  support: 'C0BJDNWK9ED',
  social: 'C0BJDM8NPLH',
});

const ALLOWED_CHANNEL_IDS: ReadonlySet<string> = new Set(Object.values(AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST));
const EXCLUDED_CHANNEL_NAMES = new Set(['secrets', 'financiar', 'management']);

export type SlackReadTarget = Readonly<{
  workspaceId: string;
  channelId: string;
  channelName?: string;
  channelType: 'PUBLIC_CHANNEL' | 'PRIVATE_CHANNEL' | 'DIRECT_MESSAGE' | 'GROUP_DIRECT_MESSAGE';
}>;

export type SlackReadDecision = Readonly<{
  status: 'ALLOWED' | 'DENIED';
  reason: string;
}>;

export function evaluateSlackReadTarget(target: SlackReadTarget): SlackReadDecision {
  if (target.workspaceId !== AGM_SLACK_WORKSPACE_ID) {
    return { status: 'DENIED', reason: 'SLACK_WORKSPACE_ISOLATION_VIOLATION' };
  }
  if (target.channelType !== 'PUBLIC_CHANNEL') {
    return { status: 'DENIED', reason: 'SLACK_NON_PUBLIC_CHANNEL_DENIED' };
  }
  if (target.channelName && EXCLUDED_CHANNEL_NAMES.has(target.channelName.trim().toLowerCase())) {
    return { status: 'DENIED', reason: 'SLACK_EXCLUDED_CHANNEL_DENIED' };
  }
  if (!ALLOWED_CHANNEL_IDS.has(target.channelId)) {
    return { status: 'DENIED', reason: 'SLACK_CHANNEL_NOT_ALLOWLISTED' };
  }
  return { status: 'ALLOWED', reason: 'SLACK_READ_TARGET_ALLOWED' };
}

export function isAllowlistedSlackChannelId(channelId: string): boolean {
  return ALLOWED_CHANNEL_IDS.has(channelId);
}
