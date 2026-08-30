package com.agm.cockpit;

import android.Manifest;
import android.content.Intent;
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
    private SpeechRecognizer speechRecognizer;
    private Intent activeRecognitionIntent;
    private boolean usingOnDeviceRecognizer;
    private boolean recognitionFallbackAttempted;
    private PluginCall listeningCall;
    private String listeningCycleId;
    private TextToSpeech textToSpeech;
    private boolean textToSpeechReady;
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
    private long ttsAuthorityGeneration;
    private long activeSpeechGeneration;
    private long lastAudioStoppedAt;
    private String lastStoppedTurnId;
    private String lastStoppedUtteranceId;
    private long lastStopRequestedAt;
    private long lastStopAcknowledgedAt;
    private long recognitionStartedAt;
    private long speechStartedAt;
    private long lastVoiceActivityAt;
    private long endOfSpeechAt;
    private boolean hasRecognizedPartialText;
    private static final long AGM_ENDPOINT_TIMEOUT_MS = 1600L;
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
        boolean preferOnDevice = Boolean.TRUE.equals(call.getBoolean("preferOnDevice", false));
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
            // Microphone/STT receives exclusive authority. This native guard
            // prevents a delayed JavaScript callback from leaving old audio
            // active when a new recognition cycle begins.
            if (pendingSpeechCall != null || activeUtteranceId != null) stopSpeakingImmediately();
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            // Preserve natural pauses. The AGM endpoint below is only armed
            // after the recognizer has produced actual partial text; Android
            // VAD alone can fire on cabin/background noise.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L);
            listeningCall = call;
            listeningCycleId = cycleId;
            call.setKeepAlive(true);
            recognitionStartedAt = SystemClock.elapsedRealtime();
            speechStartedAt = 0;
            lastVoiceActivityAt = 0;
            endOfSpeechAt = 0;
            hasRecognizedPartialText = false;
            activeRecognitionIntent = intent;
            recognitionFallbackAttempted = false;
            startRecognitionService(preferOnDevice);
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
                activeRecognitionIntent = null;
                usingOnDeviceRecognizer = false;
                recognitionFallbackAttempted = false;
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
        // TextToSpeech, its listener, and cancellation now share one Android
        // main-thread authority. A stop and a later onInit callback can no
        // longer race and resurrect an invalidated utterance.
        getActivity().runOnUiThread(() -> {
            if (pendingSpeechCall != null || activeUtteranceId != null) {
                stopSpeakingImmediately("superseded-by-new-speech");
            }

            long generation = ++ttsAuthorityGeneration;
            activeSpeechGeneration = generation;
            pendingSpeechCall = call;
            pendingSpeechText = text;
            pendingSpeechLanguage = language;
            pendingSpeechTurnId = turnId;
            activeUtteranceId = "agm-tts-" + (++ttsSequence) + "-g" + generation;
            ttsRequestedAt = SystemClock.elapsedRealtime();
            Log.i(TAG, "TTS authority granted; turnId=" + turnId + "; generation=" + generation + "; utteranceId=" + activeUtteranceId);
            if (textToSpeech == null) {
                textToSpeechReady = false;
                Log.i(TAG, "Using the user-selected Android default TTS engine");
                textToSpeech = new TextToSpeech(getContext(), this);
            } else if (textToSpeechReady) {
                speakPendingText(generation);
            } else {
                Log.i(TAG, "TTS initialization pending; current generation retained=" + generation);
            }
        });
    }

    @Override
    public void onInit(int status) {
        Log.i(TAG, "TTS initialization status=" + status);
        if (status != TextToSpeech.SUCCESS) {
            textToSpeechReady = false;
            rejectPendingSpeech("Android Text-to-Speech initialization failed", "TTS_INIT_FAILED");
            return;
        }
        textToSpeechReady = true;
        textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) {
                if (!utteranceId.equals(activeUtteranceId)) return;
                Log.i(TAG, "TTS playback started; turnId=" + pendingSpeechTurnId + "; generation=" + activeSpeechGeneration + "; utteranceId=" + utteranceId);
                notifyTtsState("speaking", pendingSpeechTurnId, SystemClock.elapsedRealtime() - ttsRequestedAt);
            }
            @Override public void onDone(String utteranceId) {
                if (!utteranceId.equals(activeUtteranceId)) return;
                Log.i(TAG, "TTS playback completed; turnId=" + pendingSpeechTurnId + "; generation=" + activeSpeechGeneration + "; utteranceId=" + utteranceId);
                notifyTtsState("completed", pendingSpeechTurnId, null);
                resolvePendingSpeech();
            }
            @Override public void onStop(String utteranceId, boolean interrupted) {
                if (!utteranceId.equals(lastStoppedUtteranceId)) {
                    Log.i(TAG, "Stale TTS stop callback suppressed; utteranceId=" + utteranceId);
                    return;
                }
                lastStopAcknowledgedAt = SystemClock.elapsedRealtime();
                long latency = lastStopRequestedAt > 0 ? Math.max(0, lastStopAcknowledgedAt - lastStopRequestedAt) : -1;
                Log.i(TAG, "TTS stop acknowledged; turnId=" + lastStoppedTurnId + "; utteranceId=" + utteranceId + "; interrupted=" + interrupted + "; requestToStopAckMs=" + latency);
                notifyTtsState("stopped", lastStoppedTurnId, null);
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
        long generation = activeSpeechGeneration;
        if (generation <= 0 || generation != ttsAuthorityGeneration || pendingSpeechCall == null) {
            Log.i(TAG, "TTS initialization callback has no current authority; no utterance started");
            return;
        }
        speakPendingText(generation);
    }

    private void speakPendingText(long generation) {
        if (pendingSpeechCall == null || textToSpeech == null || generation != ttsAuthorityGeneration || generation != activeSpeechGeneration) {
            Log.i(TAG, "Stale TTS start suppressed; requestedGeneration=" + generation + "; authorityGeneration=" + ttsAuthorityGeneration + "; activeGeneration=" + activeSpeechGeneration);
            return;
        }
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

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject receipt = stopSpeakingImmediately("javascript-cancellation");
            call.resolve(receipt);
        });
    }

    private JSObject stopSpeakingImmediately() {
        return stopSpeakingImmediately("native-cancellation");
    }

    private JSObject stopSpeakingImmediately(String reason) {
        boolean hadActiveSpeech = pendingSpeechCall != null || activeUtteranceId != null;
        String stoppedTurnId = pendingSpeechTurnId;
        String stoppedUtteranceId = activeUtteranceId;
        long stoppedGeneration = activeSpeechGeneration;
        // Invalidate authority before asking the engine to stop. Therefore an
        // onInit/onStart callback arriving during or after stop is stale by
        // construction and cannot start old audio again.
        ++ttsAuthorityGeneration;
        activeSpeechGeneration = 0;
        lastStopRequestedAt = SystemClock.elapsedRealtime();
        lastStopAcknowledgedAt = 0;
        lastStoppedTurnId = stoppedTurnId;
        lastStoppedUtteranceId = stoppedUtteranceId;
        int stopResult = textToSpeech == null ? TextToSpeech.SUCCESS : textToSpeech.stop();
        long stoppedAt = SystemClock.elapsedRealtime();
        if (hadActiveSpeech) {
            lastAudioStoppedAt = stoppedAt;
        }
        Log.i(TAG, "TTS stop requested; reason=" + reason + "; turnId=" + stoppedTurnId + "; utteranceId=" + stoppedUtteranceId + "; stoppedGeneration=" + stoppedGeneration + "; stopResult=" + stopResult);
        // The bridge promise is settled immediately after the native engine
        // accepts the flush. Actual engine completion is recorded separately
        // by UtteranceProgressListener.onStop; it is no longer inferred here.
        resolvePendingSpeech();
        JSObject receipt = new JSObject();
        if (stoppedTurnId != null) receipt.put("stoppedTurnId", stoppedTurnId);
        receipt.put("stoppedAtElapsedRealtimeMs", stoppedAt);
        receipt.put("queueFlushed", stopResult == TextToSpeech.SUCCESS);
        receipt.put("stopAccepted", stopResult == TextToSpeech.SUCCESS);
        receipt.put("stopAcknowledged", !hadActiveSpeech);
        receipt.put("activeAudioStopped", hadActiveSpeech);
        receipt.put("authorityGeneration", ttsAuthorityGeneration);
        return receipt;
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
        if (
            usingOnDeviceRecognizer
                && !recognitionFallbackAttempted
                && (error == SpeechRecognizer.ERROR_SERVER_DISCONNECTED
                    || error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED
                    || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)
        ) {
            recognitionFallbackAttempted = true;
            Log.w(TAG, "On-device speech recognizer unavailable for this request; falling back once to Android default service; error=" + error);
            getActivity().runOnUiThread(() -> startRecognitionService(false));
            return;
        }
        rejectListening("Android speech recognition error: " + error, "SPEECH_RECOGNITION_FAILED");
    }

    private void resolveListening(JSObject result) {
        PluginCall call = listeningCall;
        listeningCall = null;
        listeningCycleId = null;
        activeRecognitionIntent = null;
        usingOnDeviceRecognizer = false;
        recognitionFallbackAttempted = false;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.resolve(result); }
    }

    private void rejectListening(String message, String code) {
        PluginCall call = listeningCall;
        listeningCall = null;
        listeningCycleId = null;
        activeRecognitionIntent = null;
        usingOnDeviceRecognizer = false;
        recognitionFallbackAttempted = false;
        destroyRecognizer();
        if (call != null) { call.setKeepAlive(false); call.reject(message, code); }
    }

    private void destroyRecognizer() {
        endpointHandler.removeCallbacks(endpointStop);
        if (speechRecognizer != null) { speechRecognizer.destroy(); speechRecognizer = null; }
    }

    private void startRecognitionService(boolean preferOnDevice) {
        destroyRecognizer();
        if (activeRecognitionIntent == null || listeningCall == null) return;
        try {
            usingOnDeviceRecognizer = preferOnDevice
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
            if (usingOnDeviceRecognizer) {
                Log.i(TAG, "Using Android on-device speech recognizer");
                speechRecognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
            } else {
                Log.i(TAG, "Using Android default speech recognition service");
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            }
            speechRecognizer.setRecognitionListener(this);
            recognitionStartedAt = SystemClock.elapsedRealtime();
            speechRecognizer.startListening(activeRecognitionIntent);
        } catch (RuntimeException error) {
            if (usingOnDeviceRecognizer && !recognitionFallbackAttempted) {
                recognitionFallbackAttempted = true;
                usingOnDeviceRecognizer = false;
                Log.w(TAG, "Could not start on-device recognition; falling back once to Android default service", error);
                startRecognitionService(false);
                return;
            }
            rejectListening("Android speech recognition service could not start", "SPEECH_RECOGNITION_FAILED");
        }
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
        activeSpeechGeneration = 0;
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
        activeSpeechGeneration = 0;
        ttsRequestedAt = 0;
        if (call != null) call.reject(message, code);
    }

    @Override protected void handleOnDestroy() {
        destroyRecognizer();
        abandonSpeechAudioFocus();
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        textToSpeechReady = false;
        super.handleOnDestroy();
    }

    @Override public void onReadyForSpeech(Bundle params) {
        Log.i(TAG, "Speech recognizer ready");
        notifySpeechState("listening");
    }
    @Override public void onBeginningOfSpeech() {
        speechStartedAt = SystemClock.elapsedRealtime();
        lastVoiceActivityAt = speechStartedAt;
        // Defensive native barge-in: if audio survived until actual speech
        // detection, stop and flush it on the same UI/runtime boundary.
        if (pendingSpeechCall != null || activeUtteranceId != null) stopSpeakingImmediately();
        Log.i(TAG, "Speech detected");
        notifySpeechState("speechDetected", speechStartedAt);
        // Do not arm AGM endpointing from VAD alone. On this physical Samsung,
        // Android reports onBeginningOfSpeech for short non-speech noise.
    }
    @Override public void onEndOfSpeech() {
        endOfSpeechAt = SystemClock.elapsedRealtime();
        endpointHandler.removeCallbacks(endpointStop);
        Log.i(TAG, "Speech processing started");
        notifySpeechState("processing");
    }
    @Override public void onRmsChanged(float rmsdB) {
        if (hasRecognizedPartialText && speechStartedAt > 0 && endOfSpeechAt == 0 && rmsdB > 5.0f) {
            lastVoiceActivityAt = SystemClock.elapsedRealtime();
            armEndpointTimer();
        }
    }
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onPartialResults(Bundle partialResults) {
        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (endOfSpeechAt == 0 && matches != null && !matches.isEmpty() && !matches.get(0).trim().isEmpty()) {
            hasRecognizedPartialText = true;
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
        notifySpeechState(state, null);
    }

    private void notifySpeechState(String state, Long detectedAt) {
        if (listeningCycleId == null) return;
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("cycleId", listeningCycleId);
        if (detectedAt != null) {
            event.put("detectedAtElapsedRealtimeMs", detectedAt);
            if (lastAudioStoppedAt > 0 && detectedAt - lastAudioStoppedAt <= 30_000L) {
                event.put("oldAudioStoppedAtElapsedRealtimeMs", lastAudioStoppedAt);
                event.put("oldAudioStopLatencyMs", Math.max(0, lastAudioStoppedAt - detectedAt));
                if (lastStoppedTurnId != null) event.put("stoppedTurnId", lastStoppedTurnId);
            }
        }
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
