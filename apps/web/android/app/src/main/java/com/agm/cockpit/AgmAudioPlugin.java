package com.agm.cockpit;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(
    name = "AgmAudio",
    permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
)
public class AgmAudioPlugin extends Plugin implements RecognitionListener, TextToSpeech.OnInitListener {
    private static final String TAG = "AGM-Audio";
    private static final String GOOGLE_TTS_ENGINE = "com.google.android.tts";
    private SpeechRecognizer speechRecognizer;
    private PluginCall listeningCall;
    private String listeningCycleId;
    private TextToSpeech textToSpeech;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean ownsAudioFocus;
    private PluginCall pendingSpeechCall;
    private String pendingSpeechText;
    private String pendingSpeechLanguage;
    private String pendingSpeechTurnId;
    private String activeUtteranceId;
    private long ttsRequestedAt;
    private long ttsSequence;
    private long recognitionStartedAt;
    private long speechStartedAt;
    private long lastVoiceActivityAt;
    private long endOfSpeechAt;
    private static final long AGM_ENDPOINT_TIMEOUT_MS = 850L;
    private final Handler endpointHandler = new Handler(Looper.getMainLooper());
    private final Runnable endpointStop = () -> {
        if (speechRecognizer == null || listeningCall == null) return;
        Log.i(TAG, "AGM endpoint timeout reached; stopping recognition after " + AGM_ENDPOINT_TIMEOUT_MS + "ms");
        speechRecognizer.stopListening();
    };

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
        String cycleId = call.getString("cycleId", "").trim();
        Log.i(TAG, "Starting speech recognition; language=" + language);

        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is not granted", "MICROPHONE_PERMISSION_DENIED");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Android speech recognition service is unavailable", "SPEECH_RECOGNITION_UNAVAILABLE");
            return;
        }
        if (cycleId.isEmpty()) {
            call.reject("A voice cycle id is required", "SPEECH_CYCLE_REQUIRED");
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
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            // Slightly faster endpointing requested after the physical C0
            // comparison. Values stay close to Android defaults and preserve
            // enough pause for natural Romanian/German phrases.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 650L);
            listeningCall = call;
            listeningCycleId = cycleId;
            call.setKeepAlive(true);
            recognitionStartedAt = SystemClock.elapsedRealtime();
            speechStartedAt = 0;
            lastVoiceActivityAt = 0;
            endOfSpeechAt = 0;
            speechRecognizer.startListening(intent);
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        if (speechRecognizer == null && listeningCall == null) {
            call.resolve();
            return;
        }

        Log.i(TAG, "Immediate speech cancellation requested");
        getActivity().runOnUiThread(() -> {
            try {
                PluginCall interruptedCall = listeningCall;
                listeningCall = null;
                listeningCycleId = null;
                endpointHandler.removeCallbacks(endpointStop);
                if (speechRecognizer != null) speechRecognizer.cancel();
                destroyRecognizer();
                if (interruptedCall != null) {
                    interruptedCall.setKeepAlive(false);
                    interruptedCall.reject("Speech recognition cancelled by a newer turn", "SPEECH_CANCELLED");
                }
                call.resolve();
            } catch (Exception error) {
                Log.e(TAG, "Could not stop speech recognition", error);
                call.reject("Could not stop speech recognition", "SPEECH_STOP_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        String language = call.getString("language", Locale.getDefault().toLanguageTag());
        String turnId = call.getString("turnId", "").trim();
        Log.i(TAG, "TTS requested; language=" + language + "; characters=" + text.length());
        if (text.isEmpty()) {
            call.reject("No text was provided for speech", "TTS_EMPTY_TEXT");
            return;
        }
        if (turnId.isEmpty()) {
            call.reject("A voice turn id is required", "TTS_TURN_REQUIRED");
            return;
        }
        if (pendingSpeechCall != null) {
            if (textToSpeech != null) textToSpeech.stop();
            notifyTtsState("stopped", pendingSpeechTurnId, null);
            resolvePendingSpeech();
        }

        pendingSpeechCall = call;
        pendingSpeechText = text;
        pendingSpeechLanguage = language;
        pendingSpeechTurnId = turnId;
        activeUtteranceId = "agm-tts-" + (++ttsSequence);
        ttsRequestedAt = SystemClock.elapsedRealtime();
        if (textToSpeech == null) {
            if (isPackageInstalled(GOOGLE_TTS_ENGINE)) {
                Log.i(TAG, "Using Google Speech Services for AGM voice playback");
                textToSpeech = new TextToSpeech(getContext(), this, GOOGLE_TTS_ENGINE);
            } else {
                Log.i(TAG, "Google Speech Services unavailable; using the device default TTS engine");
                textToSpeech = new TextToSpeech(getContext(), this);
            }
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
            @Override public void onStart(String utteranceId) {
                if (!utteranceId.equals(activeUtteranceId)) return;
                Log.i(TAG, "TTS playback started");
                notifyTtsState("speaking", pendingSpeechTurnId, SystemClock.elapsedRealtime() - ttsRequestedAt);
            }
            @Override public void onDone(String utteranceId) {
                if (!utteranceId.equals(activeUtteranceId)) return;
                Log.i(TAG, "TTS playback completed");
                notifyTtsState("completed", pendingSpeechTurnId, null);
                resolvePendingSpeech();
            }
            @Override public void onError(String utteranceId) {
                if (!utteranceId.equals(activeUtteranceId)) return;
                rejectPendingSpeech("Android Text-to-Speech playback failed", "TTS_PLAYBACK_FAILED");
            }
            @Override public void onError(String utteranceId, int errorCode) {
                if (!utteranceId.equals(activeUtteranceId)) return;
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
        selectPreferredVoice(locale);
        int pitchResult = textToSpeech.setPitch(0.82f);
        if (pitchResult == TextToSpeech.ERROR) {
            Log.w(TAG, "Could not apply the AGM adult voice pitch");
        }
        // Restore the original validated Android cadence. The later 0.95
        // override made operational dialogue perceptibly slow.
        int speechRateResult = textToSpeech.setSpeechRate(1.08f);
        if (speechRateResult == TextToSpeech.ERROR) {
            Log.w(TAG, "Could not apply the AGM baseline TTS speech rate");
        }
        AudioAttributes speechAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build();
        textToSpeech.setAudioAttributes(speechAttributes);
        requestSpeechAudioFocus(speechAttributes);
        Bundle speechParameters = new Bundle();
        speechParameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
        int result = textToSpeech.speak(pendingSpeechText, TextToSpeech.QUEUE_FLUSH, speechParameters, activeUtteranceId);
        if (result == TextToSpeech.ERROR) {
            rejectPendingSpeech("Android Text-to-Speech could not start", "TTS_START_FAILED");
        }
    }

    private void requestSpeechAudioFocus(AudioAttributes speechAttributes) {
        audioManager = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        if (audioManager == null) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(speechAttributes)
                .setOnAudioFocusChangeListener(focusChange -> Log.i(TAG, "TTS audio focus=" + focusChange))
                .setWillPauseWhenDucked(false)
                .build();
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusChange -> Log.i(TAG, "TTS audio focus=" + focusChange),
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }
        ownsAudioFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        Log.i(TAG, "TTS audio focus granted=" + ownsAudioFocus);
    }

    private void abandonSpeechAudioFocus() {
        if (!ownsAudioFocus || audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        }
        ownsAudioFocus = false;
        audioFocusRequest = null;
    }

    private void selectPreferredVoice(Locale locale) {
        if (textToSpeech.getVoices() == null) return;

        List<Voice> matchingVoices = new ArrayList<>();
        for (Voice voice : textToSpeech.getVoices()) {
            if (!locale.getLanguage().equals(voice.getLocale().getLanguage())) continue;
            if (voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
            matchingVoices.add(voice);
        }

        matchingVoices.sort(
            Comparator
                .comparingInt((Voice voice) -> adultMaleVoicePreference(voice, locale)).reversed()
                .thenComparing(Voice::getName)
        );

        if (!matchingVoices.isEmpty()) {
            Voice selectedVoice = matchingVoices.get(0);
            if (textToSpeech.setVoice(selectedVoice) == TextToSpeech.SUCCESS) {
                Log.i(TAG, "Selected AGM adult TTS voice=" + selectedVoice.getName() + "; locale=" + locale.toLanguageTag());
            }
        }
    }

    private int adultMaleVoicePreference(Voice voice, Locale locale) {
        String name = voice.getName().toLowerCase(Locale.ROOT);
        int score = voice.getQuality();
        if (name.contains("male")) score += 2000;
        if (Locale.GERMAN.getLanguage().equals(locale.getLanguage()) && name.contains("de-de-x-deb")) score += 1000;
        if (Locale.ENGLISH.getLanguage().equals(locale.getLanguage()) && name.contains("en-us-x-iom")) score += 1000;
        if ("ro".equals(locale.getLanguage()) && name.contains("ro-ro-x-vfv")) score += 1000;
        if (!voice.isNetworkConnectionRequired()) score += 100;
        return score;
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (textToSpeech != null) textToSpeech.stop();
        // TextToSpeech.stop() does not emit onDone consistently. Resolve the
        // Capacitor call explicitly so a newly started question cannot remain
        // chained to the interrupted answer.
        notifyTtsState("stopped", pendingSpeechTurnId, null);
        resolvePendingSpeech();
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
        listeningCycleId = null;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.resolve(result); }
    }

    private void rejectListening(String message, String code) {
        PluginCall call = listeningCall;
        listeningCall = null;
        listeningCycleId = null;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.reject(message, code); }
    }

    private void destroyRecognizer() {
        endpointHandler.removeCallbacks(endpointStop);
        if (speechRecognizer != null) { speechRecognizer.destroy(); speechRecognizer = null; }
    }

    private long elapsedBetween(long start, long end) {
        return start > 0 && end >= start ? end - start : -1;
    }

    private void resolvePendingSpeech() {
        abandonSpeechAudioFocus();
        PluginCall call = pendingSpeechCall;
        pendingSpeechCall = null;
        pendingSpeechText = null;
        pendingSpeechLanguage = null;
        pendingSpeechTurnId = null;
        activeUtteranceId = null;
        ttsRequestedAt = 0;
        if (call != null) call.resolve();
    }

    private void rejectPendingSpeech(String message, String code) {
        Log.e(TAG, message);
        abandonSpeechAudioFocus();
        PluginCall call = pendingSpeechCall;
        pendingSpeechCall = null;
        pendingSpeechText = null;
        pendingSpeechLanguage = null;
        pendingSpeechTurnId = null;
        activeUtteranceId = null;
        ttsRequestedAt = 0;
        if (call != null) call.reject(message, code);
    }

    @Override protected void handleOnDestroy() {
        destroyRecognizer();
        abandonSpeechAudioFocus();
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        super.handleOnDestroy();
    }

    @Override public void onReadyForSpeech(Bundle params) {
        Log.i(TAG, "Speech recognizer ready");
        notifySpeechState("listening");
    }
    @Override public void onBeginningOfSpeech() {
        speechStartedAt = SystemClock.elapsedRealtime();
        lastVoiceActivityAt = speechStartedAt;
        Log.i(TAG, "Speech detected");
        notifySpeechState("speechDetected");
        armEndpointTimer();
    }
    @Override public void onEndOfSpeech() {
        endOfSpeechAt = SystemClock.elapsedRealtime();
        endpointHandler.removeCallbacks(endpointStop);
        Log.i(TAG, "Speech processing started");
        notifySpeechState("processing");
    }
    @Override public void onRmsChanged(float rmsdB) {
        if (speechStartedAt > 0 && endOfSpeechAt == 0 && rmsdB > 5.0f) {
            lastVoiceActivityAt = SystemClock.elapsedRealtime();
            armEndpointTimer();
        }
    }
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onPartialResults(Bundle partialResults) {
        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (endOfSpeechAt == 0 && matches != null && !matches.isEmpty() && !matches.get(0).trim().isEmpty()) {
            lastVoiceActivityAt = SystemClock.elapsedRealtime();
            armEndpointTimer();
        }
    }
    @Override public void onEvent(int eventType, Bundle params) {}

    private void armEndpointTimer() {
        endpointHandler.removeCallbacks(endpointStop);
        endpointHandler.postDelayed(endpointStop, AGM_ENDPOINT_TIMEOUT_MS);
    }

    private void notifySpeechState(String state) {
        if (listeningCycleId == null) return;
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("cycleId", listeningCycleId);
        notifyListeners("speechState", event);
    }

    private void notifyTtsState(String state, String turnId, Long requestToAudioStartMs) {
        if (turnId == null) return;
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("turnId", turnId);
        if (requestToAudioStartMs != null) event.put("requestToAudioStartMs", requestToAudioStartMs);
        notifyListeners("ttsState", event);
    }
}
