import type { ControlledExternalAdapter } from './external-capability.executor';
import type { ExternalPermissionRequest } from './external-capability.policy';
import {
  AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST,
  AGM_SLACK_WORKSPACE_ID,
  evaluateSlackReadTarget,
} from './slack-readonly.policy';

type SlackApiEnvelope<T> = T & { ok: boolean; error?: string };
type SlackChannel = { id: string; name: string; is_private?: boolean; is_im?: boolean; is_mpim?: boolean };

async function slackApi<T>(token: string, method: string, query: URLSearchParams, signal: AbortSignal, httpMethod: 'GET' | 'POST' = 'GET'): Promise<T> {
  const response = await fetch(`https://slack.com/api/${method}?${query}`, {
    method: httpMethod,
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`SLACK_HTTP_FAILURE_${response.status}`);
  const body = (await response.json()) as SlackApiEnvelope<T>;
  if (!body.ok) {
    const safeCode = (body.error ?? 'unknown_error').replace(/[^a-z0-9_]/gi, '_');
    throw new Error(`SLACK_API_FAILURE_${safeCode}`);
  }
  return body;
}

export function createSlackReadOnlyAdapter(token: string): ControlledExternalAdapter {
  if (!token) throw new Error('SLACK_BOT_TOKEN_NOT_CONFIGURED');
  if (!/^xoxb-[A-Za-z0-9-]+$/.test(token) || /[\r\n\s]/.test(token)) {
    throw new Error('SLACK_BOT_TOKEN_FORMAT_REJECTED');
  }
  return {
    async invoke(request: Readonly<ExternalPermissionRequest>, signal: AbortSignal) {
      const auth = await slackApi<{ team_id?: string }>(token, 'auth.test', new URLSearchParams(), signal, 'POST');
      if (auth.team_id !== AGM_SLACK_WORKSPACE_ID) throw new Error('SLACK_WORKSPACE_ISOLATION_VIOLATION');

      if (request.capabilityId === 'SLACK_CHANNELS_READ') {
        const response = await slackApi<{ channels?: SlackChannel[] }>(
          token,
          'conversations.list',
          new URLSearchParams({ types: 'public_channel', exclude_archived: 'true', limit: '200' }),
          signal,
        );
        const allowed = (response.channels ?? []).filter((channel) =>
          evaluateSlackReadTarget({
            workspaceId: auth.team_id ?? '',
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.is_private ? 'PRIVATE_CHANNEL' : 'PUBLIC_CHANNEL',
          }).status === 'ALLOWED',
        );
        return {
          workspaceId: auth.team_id,
          allowedChannelCount: allowed.length,
          channels: allowed.map(({ id, name }) => ({ id, name })),
        };
      }

      if (request.capabilityId === 'SLACK_CHANNEL_HISTORY_READ') {
        const channelId = request.scope.split(':')[1] ?? '';
        const expectedName = Object.entries(AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST).find(([, id]) => id === channelId)?.[0];
        const decision = evaluateSlackReadTarget({
          workspaceId: auth.team_id ?? '',
          channelId,
          channelName: expectedName,
          channelType: 'PUBLIC_CHANNEL',
        });
        if (decision.status === 'DENIED') throw new Error(decision.reason);
        const response = await slackApi<{ messages?: unknown[] }>(
          token,
          'conversations.history',
          new URLSearchParams({ channel: channelId, limit: '15' }),
          signal,
        );
        return { workspaceId: auth.team_id, channelId, messageCount: response.messages?.length ?? 0 };
      }

      throw new Error('SLACK_ACTION_NOT_ALLOWLISTED');
    },
  };
}
