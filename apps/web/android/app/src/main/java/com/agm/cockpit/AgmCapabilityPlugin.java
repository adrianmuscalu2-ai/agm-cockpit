package com.agm.cockpit;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgmCapability")
public class AgmCapabilityPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
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

    @com.getcapacitor.PluginMethod
    public void shareWithAi(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) { call.reject("Text is missing", "ASSISTANT_TEXT_REQUIRED"); return; }
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(share, "Trimite întrebarea către aplicația AI");
        try { getActivity().startActivity(chooser); JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out); }
        catch (Exception error) { call.reject("AI share handoff failed", "ASSISTANT_SHARE_FAILED", error); }
    }

    @com.getcapacitor.PluginMethod
    public void openAssistantSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            JSObject out = new JSObject(); out.put("status", "UNAVAILABLE"); call.resolve(out); return;
        }
        try { getActivity().startActivity(intent); JSObject out = new JSObject(); out.put("status", "OPENED"); call.resolve(out); }
        catch (Exception error) { call.reject("Assistant settings failed", "ASSISTANT_SETTINGS_FAILED", error); }
    }

    @com.getcapacitor.PluginMethod
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
}
