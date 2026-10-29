package com.agm.cockpit;

import android.os.Bundle;
import android.service.voice.VoiceInteractionService;
import android.service.voice.VoiceInteractionSession;
import android.util.Log;

/**
 * Lightweight Android-owned authority endpoint for AGMa.
 *
 * This service deliberately does not start a microphone, enroll a keyphrase,
 * or replace the current assistant. Android binds it only after the owner has
 * explicitly selected AGMa as the digital assistant.
 */
public final class AgmaVoiceInteractionService extends VoiceInteractionService {
    private static final String TAG = "AGMa-Assistant";

    @Override
    public void onReady() {
        super.onReady();
        setDisabledShowContext(
            VoiceInteractionSession.SHOW_WITH_ASSIST
                | VoiceInteractionSession.SHOW_WITH_SCREENSHOT
        );
        Log.i(TAG, "AGMa digital-assistant authority is ready after explicit owner selection");
    }

    @Override
    public void onLaunchVoiceAssistFromKeyguard() {
        Bundle args = new Bundle();
        args.putString(AgmaVoiceInteractionSessionService.EXTRA_INVOCATION_SOURCE, "KEYGUARD");
        showSession(args, 0);
    }

    @Override
    public void onShutdown() {
        Log.i(TAG, "AGMa digital-assistant authority stopped");
        super.onShutdown();
    }
}
