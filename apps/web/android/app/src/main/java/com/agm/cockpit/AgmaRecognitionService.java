package com.agm.cockpit;

import android.content.Intent;
import android.os.RemoteException;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;
import android.util.Log;

/**
 * Contract service required for Android assistant-role qualification.
 *
 * AGM speech remains owned by the existing application voice runtime. Direct
 * platform RecognitionService requests fail closed instead of starting a
 * second microphone authority or recursively delegating to the active
 * recognizer.
 */
public final class AgmaRecognitionService extends RecognitionService {
    private static final String TAG = "AGMa-Recognition";

    @Override
    protected void onStartListening(Intent recognizerIntent, Callback listener) {
        failClosed(listener);
    }

    @Override
    protected void onStopListening(Callback listener) {
        // The request already terminates in onStartListening.
    }

    @Override
    protected void onCancel(Callback listener) {
        // No microphone or recognition resource is held by this service.
    }

    private void failClosed(Callback listener) {
        try {
            listener.error(SpeechRecognizer.ERROR_CLIENT);
        } catch (RemoteException error) {
            Log.w(TAG, "Unable to return the fail-closed recognition result", error);
        }
    }
}
