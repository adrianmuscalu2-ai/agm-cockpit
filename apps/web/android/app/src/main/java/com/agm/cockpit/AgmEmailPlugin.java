package com.agm.cockpit;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgmEmail")
public class AgmEmailPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void compose(PluginCall call) {
        String recipient = call.getString("recipient", "").trim();
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");

        Uri mailUri = Uri.parse(
            "mailto:" + Uri.encode(recipient)
                + "?subject=" + Uri.encode(subject)
                + "&body=" + Uri.encode(body)
        );
        Intent intent = new Intent(Intent.ACTION_SENDTO, mailUri);
        intent.putExtra(Intent.EXTRA_EMAIL, new String[] { recipient });
        intent.putExtra(Intent.EXTRA_SUBJECT, subject);
        intent.putExtra(Intent.EXTRA_TEXT, body);

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("No configured email client is available", "EMAIL_CLIENT_UNAVAILABLE");
            return;
        }

        try {
            getActivity().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("Could not open the email client", "EMAIL_CLIENT_OPEN_FAILED", error);
        }
    }
}
