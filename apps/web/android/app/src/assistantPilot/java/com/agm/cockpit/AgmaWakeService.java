package com.agm.cockpit;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.os.*;
import com.getcapacitor.JSObject;
import com.k2fsa.sherpa.onnx.*;

/** Explicitly armed, local-only pilot detector. No recording files or network audio. */
public final class AgmaWakeService extends Service {
    private static final String CHANNEL = "agma-local-wake";
    private static final int NOTICE = 7401;
    private static volatile AgmaWakeService current;
    private static volatile String state = "OFF";
    private static volatile String failure = "";
    private static volatile long lastDetection;
    private static volatile int detections;
    private static volatile double audioRms;
    private static volatile double peakAudioRms;
    private static volatile long audioFrames;
    private static volatile long lastAudioFrame;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean armed;
    private volatile long generation;
    private volatile AudioRecord recorder;
    private volatile Thread worker;
    private PowerManager.WakeLock cpu;

    public static JSObject snapshot() {
        JSObject out = new JSObject();
        out.put("state", state); out.put("failure", failure);
        out.put("armed", current != null && current.armed);
        out.put("detections", detections); out.put("lastDetection", lastDetection);
        out.put("localOnly", true); out.put("phrase", "Hei, AGMA");
        // Amplitude and liveness only; never retain microphone content.
        out.put("audioRms", audioRms); out.put("peakAudioRms", peakAudioRms);
        out.put("audioFrames", audioFrames); out.put("lastAudioFrame", lastAudioFrame);
        return out;
    }

    @Override public void onCreate() {
        super.onCreate(); current = this;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Activare vocală AGMa", NotificationManager.IMPORTANCE_LOW));
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        cpu = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, getPackageName() + ":local-wake");
        cpu.setReferenceCounted(false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (!android.service.voice.VoiceInteractionService.isActiveService(this, new ComponentName(this, AgmaVoiceInteractionService.class))) {
            failure = "ASSISTANT_ROLE_REQUIRED"; stopSelf(); return START_NOT_STICKY;
        }
        startForeground(NOTICE, notification("Activare locală: spune «Hei, AGMA»"), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        if (!armed) {
            armed = true; failure = "";
            // Pilot session is explicitly bounded; never secretly restart on boot.
            cpu.acquire(60 * 60 * 1000L);
            main.postDelayed(this::stopSelf, 60 * 60 * 1000L);
        }
        resumeDetector();
        return START_NOT_STICKY;
    }

    private Notification notification(String message) {
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, AgmaWakeService.class).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent open = PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("AGMa · activare vocală locală").setContentText(message)
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(null, "Oprește", stop).build()).build();
    }

    private void notice(String message) { getSystemService(NotificationManager.class).notify(NOTICE, notification(message)); }

    public static boolean pauseDetector() {
        AgmaWakeService service = current;
        return service == null || service.pause();
    }
    public static void stopDetector() { AgmaWakeService service = current; if (service != null) service.stopSelf(); }

    private synchronized boolean pause() {
        generation++;
        AudioRecord audio = recorder;
        if (audio != null) try { audio.stop(); } catch (RuntimeException ignored) { }
        Thread task = worker;
        if (task != null && task != Thread.currentThread()) try { task.join(2000); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
        if (task != null && task.isAlive()) return false;
        worker = null;
        if (armed) { state = "PAUSED"; main.post(() -> { if (armed) notice("În pauză în timpul conversației"); }); }
        return true;
    }

    public static void resumeIfArmed() { AgmaWakeService service = current; if (service != null) service.main.post(service::resumeDetector); }

    private synchronized void resumeDetector() {
        if (!armed || (worker != null && worker.isAlive())) return;
        if (!android.service.voice.VoiceInteractionService.isActiveService(this, new ComponentName(this, AgmaVoiceInteractionService.class))) {
            failure = "ASSISTANT_ROLE_LOST"; stopSelf(); return;
        }
        long token = ++generation;
        audioRms = 0; peakAudioRms = 0; audioFrames = 0; lastAudioFrame = 0;
        state = "STARTING";
        worker = new Thread(() -> listen(token), "agma-local-wake");
        worker.start();
    }

    private void listen(long token) {
        KeywordSpotter detector = null;
        OnlineStream stream = null;
        AudioRecord audio = null;
        boolean detected = false;
        try {
            KeywordSpotterConfig config = new KeywordSpotterConfig();
            OnlineModelConfig model = new OnlineModelConfig();
            OnlineTransducerModelConfig transducer = new OnlineTransducerModelConfig();
            transducer.setEncoder("wakeword/encoder.onnx");
            transducer.setDecoder("wakeword/decoder.onnx");
            transducer.setJoiner("wakeword/joiner.onnx");
            model.setTransducer(transducer); model.setTokens("wakeword/tokens.txt");
            model.setModelType("zipformer2"); model.setNumThreads(1);
            config.setModelConfig(model); config.setKeywordsFile("wakeword/keywords.txt");
            detector = new KeywordSpotter(getAssets(), config);
            stream = detector.createStream("");
            if (!armed || token != generation) return;
            int size = Math.max(4096, AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT));
            audio = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size);
            if (audio.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("AUDIO_RECORD_UNAVAILABLE");
            recorder = audio; audio.startRecording(); state = "LISTENING";
            main.post(() -> { if (armed && token == generation) notice("Activare locală: spune «Hei, AGMA»"); });
            short[] pcm = new short[800];
            while (armed && token == generation) {
                int count = audio.read(pcm, 0, pcm.length);
                if (count <= 0) { if (token == generation) throw new IllegalStateException("AUDIO_READ_FAILED"); break; }
                float[] samples = new float[count];
                double energy = 0;
                for (int i = 0; i < count; i++) {
                    samples[i] = pcm[i] / 32768.0f;
                    energy += samples[i] * samples[i];
                }
                audioRms = Math.sqrt(energy / count);
                peakAudioRms = Math.max(peakAudioRms, audioRms);
                audioFrames++; lastAudioFrame = System.currentTimeMillis();
                stream.acceptWaveform(samples, 16000);
                while (detector.isReady(stream) && armed && token == generation) {
                    detector.decode(stream);
                    if ("HEY_AGMA".equals(detector.getResult(stream).getKeyword())) { detected = true; break; }
                }
                if (detected) break;
            }
        } catch (Throwable error) {
            if (armed && token == generation) {
                failure = error.getClass().getSimpleName(); state = "ERROR";
                android.util.Log.e("AGM-Wake", "Local detector failed", error);
                main.post(() -> { if (armed && token == generation) stopSelf(); });
            }
        } finally {
            if (audio != null) { try { audio.stop(); } catch (RuntimeException ignored) { } audio.release(); }
            recorder = null;
            if (stream != null) stream.release();
            if (detector != null) detector.release();
        }
        if (detected && armed && token == generation) main.post(() -> {
            if (!armed || token != generation) return;
            detections++; lastDetection = System.currentTimeMillis(); state = "DETECTED";
            android.util.Log.i("AGM-Wake", "Real microphone keyword detected; count=" + detections);
            notice("AGMa te-a auzit. Conversația preia microfonul.");
            if (!AgmaVoiceInteractionService.requestLocalWake()) { failure = "ASSISTANT_SESSION_UNAVAILABLE"; state = "PAUSED"; }
        });
    }

    @Override public void onDestroy() {
        armed = false; pause(); main.removeCallbacksAndMessages(null);
        if (cpu != null && cpu.isHeld()) cpu.release();
        stopForeground(STOP_FOREGROUND_REMOVE); current = null;
        state = failure.isEmpty() ? "OFF" : "ERROR";
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
