import { premiumVoiceShellBoundaries, type PremiumVoiceShellCapability } from './premium-voice-shell.contract';
import { disabledPremiumVoiceShellState } from './premium-voice-shell.states';
import { premiumConversationBoundaries } from './premium-conversation.contract';
import { disabledPremiumConversationState } from './premium-conversation.states';

export const premiumVoiceShellModule = {
  id: 'premium-voice-shell',
  requiredEntitlement: 'premium.voice-assistant',
  enabled: true,
  capabilities: [] as readonly PremiumVoiceShellCapability[],
  boundaries: premiumVoiceShellBoundaries,
  initialState: disabledPremiumVoiceShellState,
  conversation: {
    enabled: false,
    boundaries: premiumConversationBoundaries,
    initialState: disabledPremiumConversationState,
  },
} as const;
