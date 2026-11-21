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
    private boolean selected() { return VoiceInteractionService.isActiveService(getContext(), new ComponentName(getContext(), AgmaVoiceInteractionService.class)); }
    @PluginMethod public void status(PluginCall call) {
        JSObject value = AgmaWakeService.snapshot(); value.put("selectedAssistant", selected()); call.resolve(value);
    }
    @PluginMethod public void prepare(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { call.reject("Local wake pilot requires Android 10 or newer", "WAKE_PLATFORM_UNSUPPORTED"); return; }
        if (!selected()) { call.reject("Select AGMA Pilot as the Android assistant first", "ASSISTANT_ROLE_REQUIRED"); return; }
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
        if (!selected() || getPermissionState("microphone") != PermissionState.GRANTED || (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)) { call.reject("Wake permissions or assistant role missing", "WAKE_AUTHORITY_REQUIRED"); return; }
        try { getContext().startForegroundService(new Intent(getContext(), AgmaWakeService.class).setAction("ARM")); call.resolve(); }
        catch (RuntimeException error) { call.reject("Android could not arm the local detector", "WAKE_START_FAILED", error); }
    }
    @PluginMethod public void stop(PluginCall call) { getContext().stopService(new Intent(getContext(), AgmaWakeService.class)); call.resolve(); }
    @PluginMethod public void resume(PluginCall call) { AgmaWakeService.resumeIfArmed(); call.resolve(); }
    @PluginMethod public void pause(PluginCall call) { if (AgmaWakeService.pauseDetector()) call.resolve(); else call.reject("Microphone release timed out", "WAKE_MICROPHONE_BUSY"); }
}
