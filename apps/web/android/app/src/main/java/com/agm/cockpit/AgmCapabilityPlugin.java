package com.agm.cockpit;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgmCapability")
public class AgmCapabilityPlugin extends Plugin {
    @PluginMethod
    public void getCapabilities(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        JSObject out = new JSObject();
        out.put("sdkInt", Build.VERSION.SDK_INT);
        out.put("online", isOnline());
        out.put("speechRecognition", SpeechRecognizer.isRecognitionAvailable(getContext()));
        out.put(
            "onDeviceSpeechRecognition",
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())
        );
        out.put("textToSpeech", hasService(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE)));
        out.put("camera", packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY));
        out.put("shareText", hasActivity(textIntent(Intent.ACTION_SEND)));
        out.put("processText", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && hasActivity(textIntent(Intent.ACTION_PROCESS_TEXT)));
        out.put("translateText", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && hasActivity(textIntent(Intent.ACTION_TRANSLATE)));
        out.put("assist", hasActivity(new Intent(Intent.ACTION_ASSIST)));
        out.put("voiceSettings", hasActivity(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)));
        call.resolve(out);
    }

    @PluginMethod
    public void launchAssistant(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_ASSIST);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            JSObject out = new JSObject(); out.put("status", "UNAVAILABLE"); call.resolve(out); return;
        }
        try {
            getActivity().startActivity(intent);
            JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out);
        } catch (Exception error) {
            call.reject("Android assistant handoff failed", "ASSISTANT_HANDOFF_FAILED", error);
        }
    }

    @PluginMethod
    public void shareWithAi(PluginCall call) {
        String text = call.getString("text", "").trim();
        String chooserTitle = call.getString("chooserTitle", "Share question").trim();
        if (text.isEmpty()) { call.reject("Text is missing", "ASSISTANT_TEXT_REQUIRED"); return; }
        if (chooserTitle.isEmpty()) chooserTitle = "Share question";
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT, text);
        if (!hasActivity(share)) {
            JSObject out = new JSObject(); out.put("status", "UNAVAILABLE"); call.resolve(out); return;
        }
        Intent chooser = Intent.createChooser(share, chooserTitle);
        try { getActivity().startActivity(chooser); JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out); }
        catch (Exception error) { call.reject("AI share handoff failed", "ASSISTANT_SHARE_FAILED", error); }
    }

    @PluginMethod
    public void openAssistantSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            JSObject out = new JSObject(); out.put("status", "UNAVAILABLE"); call.resolve(out); return;
        }
        try { getActivity().startActivity(intent); JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out); }
        catch (Exception error) { call.reject("Assistant settings failed", "ASSISTANT_SETTINGS_FAILED", error); }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String capabilityId = call.getString("capabilityId", "");
        String value = call.getString("value", "").trim();
        Intent intent;
        if ("OPEN_DIALER".equals(capabilityId)) intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(value)));
        else if ("OPEN_MAPS".equals(capabilityId)) intent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(value)));
        else { call.reject("Capability is not allowlisted", "CAPABILITY_DENIED"); return; }
        if (value.isEmpty()) { call.reject("Capability value is missing", "CAPABILITY_INPUT_REQUIRED"); return; }
        if (intent.resolveActivity(getContext().getPackageManager()) == null) { JSObject out = new JSObject(); out.put("status", "UNAVAILABLE"); call.resolve(out); return; }
        try { getActivity().startActivity(intent); JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out); }
        catch (Exception error) { call.reject("System handoff failed", "CAPABILITY_HANDOFF_FAILED", error); }
    }

    private Intent textIntent(String action) {
        Intent intent = new Intent(action);
        intent.setType("text/plain");
        return intent;
    }

    private boolean hasActivity(Intent intent) {
        return intent.resolveActivity(getContext().getPackageManager()) != null;
    }

    private boolean hasService(Intent intent) {
        return !getContext().getPackageManager().queryIntentServices(intent, PackageManager.MATCH_DEFAULT_ONLY).isEmpty();
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return false;
        Network activeNetwork = manager.getActiveNetwork();
        if (activeNetwork == null) return false;
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(activeNetwork);
        return capabilities != null
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
