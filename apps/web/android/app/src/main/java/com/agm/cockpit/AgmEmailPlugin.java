package com.agm.cockpit;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "AgmEmail")
public class AgmEmailPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void compose(PluginCall call) {
        String recipient = call.getString("recipient", "").trim();
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");

        ArrayList<Uri> attachments;
        try {
            attachments = writeAttachments(call.getArray("attachments"));
        } catch (Exception error) {
            call.reject("Could not prepare email attachments", "EMAIL_ATTACHMENT_PREPARE_FAILED", error);
            return;
        }

        Intent intent;
        if (attachments.isEmpty()) {
            Uri mailUri = Uri.parse(
                "mailto:" + Uri.encode(recipient)
                    + "?subject=" + Uri.encode(subject)
                    + "&body=" + Uri.encode(body)
            );
            intent = new Intent(Intent.ACTION_SENDTO, mailUri);
        } else {
            intent = new Intent(attachments.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            intent.setType("application/octet-stream");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (attachments.size() == 1) {
                intent.putExtra(Intent.EXTRA_STREAM, attachments.get(0));
            } else {
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, attachments);
            }
        }
        intent.putExtra(Intent.EXTRA_EMAIL, new String[] { recipient });
        intent.putExtra(Intent.EXTRA_SUBJECT, subject);
        intent.putExtra(Intent.EXTRA_TEXT, body);

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("No configured email client is available", "EMAIL_CLIENT_UNAVAILABLE");
            return;
        }

        try {
            getActivity().startActivity(attachments.isEmpty() ? intent : Intent.createChooser(intent, "Choose email app"));
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("Could not open the email client", "EMAIL_CLIENT_OPEN_FAILED", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void share(PluginCall call) {
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");
        ArrayList<Uri> attachments;
        try {
            attachments = writeAttachments(call.getArray("attachments"));
        } catch (Exception error) {
            call.reject("Could not prepare shared attachments", "SHARE_ATTACHMENT_PREPARE_FAILED", error);
            return;
        }

        Intent intent = new Intent(attachments.size() > 1 ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
        intent.setType(attachments.isEmpty() ? "text/plain" : "application/octet-stream");
        intent.putExtra(Intent.EXTRA_SUBJECT, subject);
        intent.putExtra(Intent.EXTRA_TEXT, body);
        if (!attachments.isEmpty()) {
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (attachments.size() == 1) intent.putExtra(Intent.EXTRA_STREAM, attachments.get(0));
            else intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, attachments);
        }

        try {
            getActivity().startActivity(Intent.createChooser(intent, "Share with"));
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("Could not open the share sheet", "SHARE_UNAVAILABLE", error);
        }
    }

    private ArrayList<Uri> writeAttachments(JSArray input) throws Exception {
        ArrayList<Uri> uris = new ArrayList<>();
        if (input == null || input.length() == 0) return uris;
        if (input.length() > 5) throw new IllegalArgumentException("Too many attachments");

        File directory = new File(getContext().getCacheDir(), "agm-mail-attachments");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Attachment cache unavailable");
        File[] previousFiles = directory.listFiles();
        if (previousFiles != null) {
            for (File previous : previousFiles) {
                if (previous.isFile()) previous.delete();
            }
        }

        long totalBytes = 0;
        for (int index = 0; index < input.length(); index++) {
            JSONObject item = input.getJSONObject(index);
            byte[] bytes = Base64.decode(item.optString("base64", ""), Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > 10 * 1024 * 1024) throw new IllegalArgumentException("Invalid attachment size");
            totalBytes += bytes.length;
            if (totalBytes > 20 * 1024 * 1024) throw new IllegalArgumentException("Attachment total too large");

            String safeName = item.optString("name", "attachment").replaceAll("[^A-Za-z0-9._-]", "_");
            if (safeName.isEmpty()) safeName = "attachment";
            File output = new File(directory, System.currentTimeMillis() + "-" + index + "-" + safeName);
            try (FileOutputStream stream = new FileOutputStream(output)) {
                stream.write(bytes);
            }
            uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", output));
        }
        return uris;
    }
}
