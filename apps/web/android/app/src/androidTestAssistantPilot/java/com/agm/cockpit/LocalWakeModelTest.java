package com.agm.cockpit;

import androidx.test.platform.app.InstrumentationRegistry;
import com.k2fsa.sherpa.onnx.*;
import java.io.*;
import java.nio.*;
import org.junit.Test;
import static org.junit.Assert.*;

/** Synthetic fixture validation only: this is never proof of microphone wake. */
public class LocalWakeModelTest {
    private String decode(String file) throws Exception {
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        return AgmaWakeModelProbe.decode(instrumentation.getTargetContext().getAssets(), instrumentation.getContext().getAssets(), file);
    }
    @Test public void positiveSyntheticPhrase() throws Exception { assertEquals("HEY_AGMA", decode("wake-positive.wav")); }
    @Test public void unrelatedSyntheticSpeech() throws Exception { assertEquals("", decode("wake-negative.wav")); }
    @Test public void similarNamesMustNotWake() throws Exception { assertEquals("", decode("wake-confusable.wav")); }
}
