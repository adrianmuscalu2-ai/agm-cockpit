package com.agm.cockpit;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "AgmAudio",
    permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
)
public class AgmAudioPlugin extends Plugin implements RecognitionListener, TextToSpeech.OnInitListener {
    private static final String TAG = "AGM-Audio";
    private SpeechRecognizer speechRecognizer;
    private PluginCall listeningCall;
    private TextToSpeech textToSpeech;
    private PluginCall pendingSpeechCall;
    private String pendingSpeechText;
    private String pendingSpeechLanguage;
    private long recognitionStartedAt;
    private long speechStartedAt;
    private long lastVoiceActivityAt;
    private long endOfSpeechAt;

    @PluginMethod
    public void checkMicrophonePermission(PluginCall call) {
        String state = getPermissionState("microphone").toString();
        Log.i(TAG, "Microphone permission state: " + state);
        JSObject result = new JSObject();
        result.put("state", state);
        call.resolve(result);
    }

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        Log.i(TAG, "Requesting microphone permission");
        requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        String state = getPermissionState("microphone").toString();
        Log.i(TAG, "Microphone permission result: " + state);
        JSObject result = new JSObject();
        result.put("state", state);
        call.resolve(result);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        String language = call.getString("language", Locale.getDefault().toLanguageTag());
        Log.i(TAG, "Starting speech recognition; language=" + language);

        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is not granted", "MICROPHONE_PERMISSION_DENIED");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Android speech recognition service is unavailable", "SPEECH_RECOGNITION_UNAVAILABLE");
            return;
        }
        if (listeningCall != null) {
            call.reject("Speech recognition is already active", "SPEECH_RECOGNITION_ACTIVE");
            return;
        }

        getActivity().runOnUiThread(() -> {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            speechRecognizer.setRecognitionListener(this);
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            listeningCall = call;
            call.setKeepAlive(true);
            recognitionStartedAt = SystemClock.elapsedRealtime();
            speechStartedAt = 0;
            lastVoiceActivityAt = 0;
            endOfSpeechAt = 0;
            speechRecognizer.startListening(intent);
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        String language = call.getString("language", Locale.getDefault().toLanguageTag());
        Log.i(TAG, "TTS requested; language=" + language + "; characters=" + text.length());
        if (text.isEmpty()) {
            call.reject("No text was provided for speech", "TTS_EMPTY_TEXT");
            return;
        }

        pendingSpeechCall = call;
        pendingSpeechText = text;
        pendingSpeechLanguage = language;
        if (textToSpeech == null) {
            textToSpeech = new TextToSpeech(getContext(), this);
        } else {
            speakPendingText();
        }
    }

    @Override
    public void onInit(int status) {
        Log.i(TAG, "TTS initialization status=" + status);
        if (status != TextToSpeech.SUCCESS) {
            rejectPendingSpeech("Android Text-to-Speech initialization failed", "TTS_INIT_FAILED");
            return;
        }
        textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { Log.i(TAG, "TTS playback started"); }
            @Override public void onDone(String utteranceId) {
                Log.i(TAG, "TTS playback completed");
                resolvePendingSpeech();
            }
            @Override public void onError(String utteranceId) {
                rejectPendingSpeech("Android Text-to-Speech playback failed", "TTS_PLAYBACK_FAILED");
            }
            @Override public void onError(String utteranceId, int errorCode) {
                rejectPendingSpeech("Android Text-to-Speech error: " + errorCode, "TTS_PLAYBACK_FAILED");
            }
        });
        speakPendingText();
    }

    private void speakPendingText() {
        if (pendingSpeechCall == null || textToSpeech == null) return;
        Locale locale = Locale.forLanguageTag(pendingSpeechLanguage);
        int languageResult = textToSpeech.setLanguage(locale);
        if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
            rejectPendingSpeech("TTS language is unavailable: " + pendingSpeechLanguage, "TTS_LANGUAGE_UNAVAILABLE");
            return;
        }
        int result = textToSpeech.speak(pendingSpeechText, TextToSpeech.QUEUE_FLUSH, null, "agm-tts");
        if (result == TextToSpeech.ERROR) {
            rejectPendingSpeech("Android Text-to-Speech could not start", "TTS_START_FAILED");
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (textToSpeech != null) textToSpeech.stop();
        Log.i(TAG, "TTS playback stopped");
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @Override public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        String text = matches == null || matches.isEmpty() ? "" : matches.get(0).trim();
        Log.i(TAG, "Speech recognition result; characters=" + text.length());
        if (text.isEmpty()) rejectListening("No speech was recognized", "SPEECH_EMPTY_RESULT");
        else {
            long resultAt = SystemClock.elapsedRealtime();
            JSObject timing = new JSObject();
            timing.put("startToSpeechMs", elapsedBetween(recognitionStartedAt, speechStartedAt));
            timing.put("speechToEndMs", elapsedBetween(speechStartedAt, endOfSpeechAt));
            timing.put("silenceToEndMs", elapsedBetween(lastVoiceActivityAt, endOfSpeechAt));
            timing.put("endToResultMs", elapsedBetween(endOfSpeechAt, resultAt));
            timing.put("totalRecognitionMs", elapsedBetween(recognitionStartedAt, resultAt));
            JSObject result = new JSObject();
            result.put("text", text);
            result.put("timing", timing);
            Log.i(TAG, "Speech timing: " + timing.toString());
            resolveListening(result);
        }
    }

    @Override public void onError(int error) {
        Log.e(TAG, "Speech recognition error=" + error);
        rejectListening("Android speech recognition error: " + error, "SPEECH_RECOGNITION_FAILED");
    }

    private void resolveListening(JSObject result) {
        PluginCall call = listeningCall;
        listeningCall = null;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.resolve(result); }
    }

    private void rejectListening(String message, String code) {
        PluginCall call = listeningCall;
        listeningCall = null;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.reject(message, code); }
    }

    private void destroyRecognizer() {
        if (speechRecognizer != null) { speechRecognizer.destroy(); speechRecognizer = null; }
    }

    private long elapsedBetween(long start, long end) {
        return start > 0 && end >= start ? end - start : -1;
    }

    private void resolvePendingSpeech() {
        PluginCall call = pendingSpeechCall;
        pendingSpeechCall = null;
        pendingSpeechText = null;
        pendingSpeechLanguage = null;
        if (call != null) call.resolve();
    }

    private void rejectPendingSpeech(String message, String code) {
        Log.e(TAG, message);
        PluginCall call = pendingSpeechCall;
        pendingSpeechCall = null;
        pendingSpeechText = null;
        pendingSpeechLanguage = null;
        if (call != null) call.reject(message, code);
    }

    @Override protected void handleOnDestroy() {
        destroyRecognizer();
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        super.handleOnDestroy();
    }

    @Override public void onReadyForSpeech(Bundle params) {
        Log.i(TAG, "Speech recognizer ready");
        JSObject event = new JSObject(); event.put("state", "listening"); notifyListeners("speechState", event);
    }
    @Override public void onBeginningOfSpeech() {
        speechStartedAt = SystemClock.elapsedRealtime();
        lastVoiceActivityAt = speechStartedAt;
        Log.i(TAG, "Speech detected");
    }
    @Override public void onEndOfSpeech() {
        endOfSpeechAt = SystemClock.elapsedRealtime();
        Log.i(TAG, "Speech processing started");
        JSObject event = new JSObject(); event.put("state", "processing"); notifyListeners("speechState", event);
    }
    @Override public void onRmsChanged(float rmsdB) {
        if (speechStartedAt > 0 && rmsdB > 2.0f) lastVoiceActivityAt = SystemClock.elapsedRealtime();
    }
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
