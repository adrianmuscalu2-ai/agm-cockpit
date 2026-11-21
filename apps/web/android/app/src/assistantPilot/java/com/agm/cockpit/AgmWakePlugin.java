package com.agm.cockpit;

import android.Manifest;
import android.content.*;
import android.os.Build;
import android.service.voice.VoiceInteractionService;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

@CapacitorPlugin(name="AgmWake", permissions={
    @Permission(alias="microphone", strings={Manifest.permission.RECORD_AUDIO}),
    @Permission(alias="notifications", strings={Manifest.permission.POST_NOTIFICATIONS})
})
public final class AgmWakePlugin extends Plugin {
    private boolean diagnosticsAllowed() { return (getContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0; }
    private boolean selected() { return VoiceInteractionService.isActiveService(getContext(), new ComponentName(getContext(), AgmaVoiceInteractionService.class)); }
    @PluginMethod public void status(PluginCall call) {
        JSObject value = AgmaWakeService.snapshot(); value.put("selectedAssistant", selected()); value.put("assistantName", getContext().getString(com.agm.cockpit.R.string.agma_assistant_name)); call.resolve(value);
    }
    @PluginMethod public void prepare(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { call.reject("Local wake pilot requires Android 10 or newer", "WAKE_PLATFORM_UNSUPPORTED"); return; }
        if (!selected()) { call.reject("Select AGMa as the Android assistant first", "ASSISTANT_ROLE_REQUIRED"); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) { requestPermissionForAlias("microphone", call, "afterMicrophone"); return; }
        afterMicrophone(call);
    }
    @PermissionCallback private void afterMicrophone(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("Microphone permission required", "MICROPHONE_PERMISSION_DENIED"); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) { requestPermissionForAlias("notifications", call, "afterNotifications"); return; }
        afterNotifications(call);
    }
    @PermissionCallback private void afterNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) { call.reject("Visible notification required", "NOTIFICATION_PERMISSION_DENIED"); return; }
        JSObject out = new JSObject(); out.put("microphone", "granted"); call.resolve(out);
    }
    @PluginMethod public void arm(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { call.reject("Local wake requires Android 10 or newer", "WAKE_PLATFORM_UNSUPPORTED"); return; }
        if (!selected() || getPermissionState("microphone") != PermissionState.GRANTED || (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)) { call.reject("Wake permissions or assistant role missing", "WAKE_AUTHORITY_REQUIRED"); return; }
        try { getContext().startForegroundService(new Intent(getContext(), AgmaWakeService.class).setAction("ARM")); call.resolve(); }
        catch (RuntimeException error) { call.reject("Android could not arm the local detector", "WAKE_START_FAILED", error); }
    }
    @PluginMethod public void stop(PluginCall call) { getContext().stopService(new Intent(getContext(), AgmaWakeService.class)); call.resolve(); }
    /** Runs only packaged synthetic fixtures; does not touch microphone or authentication. */
    @PluginMethod public void verifyModelFixtures(PluginCall call) {
        if (!diagnosticsAllowed()) { call.reject("Diagnostics are unavailable in release builds", "DIAGNOSTICS_DISABLED"); return; }
        if (getActivity() == null || !getActivity().hasWindowFocus()) { call.reject("Open pilot for model checks"); return; }
        new Thread(() -> {
            try {
                Context fixtures = getContext().createPackageContext(getContext().getPackageName() + ".test", 0);
                JSObject results = new JSObject(); boolean passed = true;
                String[] files = {"wake-positive.wav", "wake-negative.wav", "wake-confusable.wav"};
                for (String file : files) {
                    String actual = AgmaWakeModelProbe.decode(getContext().getAssets(), fixtures.getAssets(), file);
                    String expected = file.equals("wake-positive.wav") ? "HEY_AGMA" : "";
                    results.put(file, actual); passed &= expected.equals(actual);
                }
                results.put("passed", passed); results.put("syntheticOnly", true); call.resolve(results);
            } catch (Exception error) { call.reject("Synthetic model check failed", "MODEL_FIXTURE_FAILED", error); }
        }, "agma-wake-fixtures").start();
    }
    @PluginMethod public void calibrate(PluginCall call) {
        if (!diagnosticsAllowed()) { call.reject("Diagnostics are unavailable in release builds", "DIAGNOSTICS_DISABLED"); return; }
        if (!selected() || getActivity() == null || !getActivity().hasWindowFocus() || getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Open the armed pilot before local calibration", "CALIBRATION_AUTHORITY_REQUIRED"); return;
        }
        if (!AgmaWakeService.calibrate()) { call.reject("Arm the detector before calibration", "WAKE_NOT_LISTENING"); return; }
        call.resolve();
    }
    @PluginMethod public void resume(PluginCall call) { AgmaWakeService.resumeIfArmed(); call.resolve(); }
    @PluginMethod public void pause(PluginCall call) { if (AgmaWakeService.pauseDetector()) call.resolve(); else call.reject("Microphone release timed out", "WAKE_MICROPHONE_BUSY"); }
}
