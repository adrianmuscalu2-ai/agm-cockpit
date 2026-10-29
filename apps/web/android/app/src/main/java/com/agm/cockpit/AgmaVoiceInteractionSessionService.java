package com.agm.cockpit;

import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;
import android.service.voice.VoiceInteractionSessionService;
import android.util.Log;

/**
 * Creates an Android-owned assistant session and hands it into the existing
 * AGM activity. It does not implement a parallel voice controller.
 */
public final class AgmaVoiceInteractionSessionService extends VoiceInteractionSessionService {
    public static final String EXTRA_INVOCATION_SOURCE = "agma.assistant.invocationSource";
    public static final String EXTRA_ASSISTANT_SESSION = "agma.assistant.session";
    private static final String TAG = "AGMa-Session";

    @Override
    public VoiceInteractionSession onNewSession(Bundle args) {
        return new VoiceInteractionSession(this) {
            @Override
            public void onPrepareShow(Bundle sessionArgs, int showFlags) {
                setUiEnabled(false);
            }

            @Override
            public void onShow(Bundle sessionArgs, int showFlags) {
                Intent intent = new Intent(
                    AgmaVoiceInteractionSessionService.this,
                    MainActivity.class
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                intent.putExtra(EXTRA_ASSISTANT_SESSION, true);
                intent.putExtra(
                    EXTRA_INVOCATION_SOURCE,
                    sessionArgs == null
                        ? "SYSTEM_ASSISTANT"
                        : sessionArgs.getString(EXTRA_INVOCATION_SOURCE, "SYSTEM_ASSISTANT")
                );
                Log.i(TAG, "Opening the existing AGM voice surface from Android assistant authority");
                startAssistantActivity(intent);
                hide();
            }
        };
    }
}
