package com.agm.cockpit;
import com.k2fsa.sherpa.onnx.*;
import java.io.*;
import java.nio.*;
/** Shared synthetic-fixture decoder. Never captures microphone audio. */
final class AgmaWakeModelProbe {
    private static void require(boolean value) { if (!value) throw new IllegalArgumentException("Invalid PCM fixture"); }
    private static void requireEquals(Object expected, Object actual) {
        require(expected instanceof Number && actual instanceof Number ? ((Number)expected).doubleValue() == ((Number)actual).doubleValue() : expected.equals(actual));
    }
    static String decode(android.content.res.AssetManager modelAssets, android.content.res.AssetManager fixtureAssets, String file) throws Exception {
        KeywordSpotterConfig config = new KeywordSpotterConfig();
        OnlineModelConfig model = new OnlineModelConfig();
        OnlineTransducerModelConfig transducer = new OnlineTransducerModelConfig();
        transducer.setEncoder("wakeword/encoder.onnx");
        transducer.setDecoder("wakeword/decoder.onnx");
        transducer.setJoiner("wakeword/joiner.onnx");
        model.setTransducer(transducer); model.setTokens("wakeword/tokens.txt");
        model.setModelType("zipformer2"); model.setNumThreads(1);
        config.setModelConfig(model); config.setKeywordsFile("wakeword/keywords.txt");
        KeywordSpotter detector = new KeywordSpotter(modelAssets, config);
        OnlineStream stream = detector.createStream("");
        try (InputStream input = fixtureAssets.open(file)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            byte[] bytes = output.toByteArray();
            ByteBuffer wav = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            requireEquals("RIFF", new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII));
            int dataStart = -1, dataLength = 0;
            for (int p = 12; p + 8 <= bytes.length;) {
                String chunk = new String(bytes, p, 4, java.nio.charset.StandardCharsets.US_ASCII);
                int length = wav.getInt(p + 4);
                if (chunk.equals("fmt ")) {
                    requireEquals(1, wav.getShort(p + 8)); requireEquals(1, wav.getShort(p + 10));
                    requireEquals(16000, wav.getInt(p + 12)); requireEquals(16, wav.getShort(p + 22));
                }
                if (chunk.equals("data")) { dataStart = p + 8; dataLength = length; break; }
                p += 8 + length + (length & 1);
            }
            require(dataStart >= 0 && dataStart + dataLength <= bytes.length);
            float[] samples = new float[dataLength / 2 + 16000]; // trailing silence flushes final keyword
            for (int i = 0; i < dataLength / 2; i++) samples[i] = wav.getShort(dataStart + 2 * i) / 32768.0f;
            String result = "";
            for (int start = 0; start < samples.length; start += 800) {
                stream.acceptWaveform(java.util.Arrays.copyOfRange(samples, start, Math.min(start + 800, samples.length)), 16000);
                while (detector.isReady(stream)) {
                    detector.decode(stream);
                    String keyword = detector.getResult(stream).getKeyword();
                    if (!keyword.isEmpty()) { result = keyword; detector.reset(stream); }
                }
            }
            android.util.Log.i("AGM-Wake-Fixture", file + " result=" + result);
            return result;
        } finally { stream.release(); detector.release(); }
    }
}
