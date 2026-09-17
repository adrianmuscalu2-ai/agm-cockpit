package com.agm.cockpit;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class DeviceHandoffIntents {
    private static final String MESSENGER_PACKAGE = "com.facebook.orca";
    private static final String[] MAPS_PACKAGES = { "com.google.android.apps.maps" };
    private static final String[] WAZE_PACKAGES = { "com.waze" };
    private static final String[] TOMTOM_PACKAGES = {
        "com.tomtom.gplay.navapp",
        "com.tomtom.speedcams.android.map",
        "com.tomtom.gplay.navapp.gofleet",
    };

    private DeviceHandoffIntents() {}

    static JSObject launchAssistant(Activity activity, String contextText) {
        String selectedPackage = selectedAssistantPackage(activity);
        Intent intent = new Intent(Intent.ACTION_ASSIST);
        if (selectedPackage != null) intent.setPackage(selectedPackage);
        String context = clean(contextText, 2000);
        if (!context.isEmpty()) {
            Bundle assistContext = new Bundle();
            assistContext.putString("agm_context", context);
            intent.putExtra(Intent.EXTRA_ASSIST_CONTEXT, assistContext);
            intent.putExtra(Intent.EXTRA_TEXT, context);
        }
        JSObject opened = start(activity, intent, "NO_DEFAULT_ASSISTANT");
        if ("OPENED".equals(opened.optString("status"))) return opened;
        if (selectedPackage == null) return opened;
        Intent launcher = activity.getPackageManager().getLaunchIntentForPackage(selectedPackage);
        return launcher == null ? opened : start(activity, launcher, "DEFAULT_ASSISTANT_APP_UNAVAILABLE");
    }

    static JSObject perform(
        Activity activity,
        String action,
        String value,
        String contextText,
        Integer hour,
        Integer minute,
        Long startEpochMs,
        String mimeType,
        String contentUri,
        String subject,
        String navigationApp
    ) {
        String normalizedAction = clean(action, 40).toUpperCase(Locale.ROOT);
        String normalizedValue = clean(value, 500);
        if ("ASSISTANT".equals(normalizedAction)) return launchAssistant(activity, contextText);
        if (normalizedValue.isEmpty() && !"SHARE".equals(normalizedAction)) return result("INVALID_INPUT", "VALUE_REQUIRED", null);

        Intent intent;
        switch (normalizedAction) {
            case "NAVIGATION":
                return navigation(activity, normalizedValue, clean(navigationApp, 20));
            case "DIAL":
                intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(normalizedValue)));
                break;
            case "OPEN_APP":
                return openApp(activity, normalizedValue);
            case "CALENDAR":
            case "REMINDER":
                intent = new Intent(Intent.ACTION_INSERT)
                    .setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE, normalizedValue);
                if (startEpochMs != null && startEpochMs > 0) {
                    intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startEpochMs);
                }
                break;
            case "ALARM":
                if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                    return result("INVALID_INPUT", "VALID_TIME_REQUIRED", null);
                }
                intent = new Intent(AlarmClock.ACTION_SET_ALARM)
                    .putExtra(AlarmClock.EXTRA_HOUR, hour)
                    .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    .putExtra(AlarmClock.EXTRA_MESSAGE, normalizedValue)
                    .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                break;
            case "SHARE":
                return share(activity, normalizedValue, clean(contextText, 2000), clean(mimeType, 120), clean(contentUri, 2000));
            case "EMAIL_DRAFT":
                return emailDraft(activity, normalizedValue, clean(subject, 180), clean(contextText, 4000));
            case "MESSENGER_CHAT":
                return messengerChat(activity, normalizedValue);
            default:
                return result("UNSUPPORTED", "ACTION_NOT_ALLOWLISTED", null);
        }
        return start(activity, intent, "NO_COMPATIBLE_ANDROID_HANDLER");
    }

    static JSObject protocolStatus(Activity activity) {
        PackageManager manager = activity.getPackageManager();
        JSObject targets = new JSObject();
        String selectedAssistant = selectedAssistantPackage(activity);
        Intent assistantIntent = new Intent(Intent.ACTION_ASSIST);
        if (selectedAssistant != null) assistantIntent.setPackage(selectedAssistant);
        boolean selectedAssistantAvailable = hasHandler(manager, assistantIntent)
            || (selectedAssistant != null && manager.getLaunchIntentForPackage(selectedAssistant) != null);
        targets.put("assistant", selectedAssistantAvailable);
        Intent navigationProbe = navigationIntent("Heilbronn");
        targets.put("navigation", hasHandler(manager, navigationProbe));
        targets.put("dialer", hasHandler(manager, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:000"))));
        targets.put("calendar", hasHandler(manager, new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)));
        targets.put("share", hasHandler(manager, new Intent(Intent.ACTION_SEND).setType("text/plain")));
        targets.put("emailDraft", hasHandler(manager, new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"))));
        targets.put("messenger", hasHandler(manager, new Intent(Intent.ACTION_VIEW, Uri.parse("https://m.me/messenger")).setPackage(MESSENGER_PACKAGE)));
        JSObject navigationApps = new JSObject();
        navigationApps.put("maps", hasPackagedHandler(manager, navigationProbe, MAPS_PACKAGES));
        navigationApps.put("waze", hasPackagedHandler(manager, navigationProbe, WAZE_PACKAGES));
        navigationApps.put("tomtom", hasPackagedHandler(manager, navigationProbe, TOMTOM_PACKAGES));
        JSObject permissions = new JSObject();
        permissions.put("assistant", "NOT_REQUIRED");
        permissions.put("navigation", "NOT_REQUIRED");
        permissions.put("dialer", "NOT_REQUIRED");
        permissions.put("calendar", "NOT_REQUIRED");
        permissions.put("share", "NOT_REQUIRED");
        permissions.put("emailDraft", "NOT_REQUIRED");
        permissions.put("messenger", "NOT_REQUIRED");
        JSObject out = new JSObject();
        out.put("schemaVersion", 1);
        out.put("capturedAtEpochMs", System.currentTimeMillis());
        if (selectedAssistant != null) out.put("selectedAssistantPackage", selectedAssistant);
        out.put("targets", targets);
        out.put("navigationApps", navigationApps);
        out.put("permissions", permissions);
        JSObject runtimePermissions = new JSObject();
        runtimePermissions.put("microphone", PermissionProtocol.status(activity, Manifest.permission.RECORD_AUDIO));
        runtimePermissions.put("camera", PermissionProtocol.status(activity, Manifest.permission.CAMERA));
        runtimePermissions.put("contacts", PermissionProtocol.status(activity, Manifest.permission.READ_CONTACTS));
        out.put("runtimePermissions", runtimePermissions);
        return out;
    }

    static JSObject openAssistantSettings(Activity activity) {
        Intent voiceSettings = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
        if (voiceSettings.resolveActivity(activity.getPackageManager()) != null) {
            return start(activity, voiceSettings, "VOICE_SETTINGS_UNAVAILABLE");
        }
        return start(activity, new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS), "DEFAULT_APPS_SETTINGS_UNAVAILABLE");
    }

    private static JSObject navigation(Activity activity, String destination, String requestedApp) {
        Intent baseIntent = navigationIntent(destination);
        String provider = requestedApp.toUpperCase(Locale.ROOT);
        String[] packages = navigationPackages(provider);
        if (packages != null) {
            for (String packageName : packages) {
                Intent targeted = new Intent(baseIntent).setPackage(packageName);
                if (hasHandler(activity.getPackageManager(), targeted)) {
                    return start(activity, targeted, provider + "_NAVIGATION_UNAVAILABLE");
                }
            }
        }

        JSObject fallback = start(activity, baseIntent, "NO_COMPATIBLE_ANDROID_HANDLER");
        if (packages != null && "OPENED".equals(fallback.optString("status"))) {
            fallback.put("reason", "REQUESTED_NAVIGATION_APP_UNAVAILABLE_FALLBACK_OPENED");
            fallback.put("fallback", "GENERIC_ANDROID_NAVIGATION");
            fallback.put("requestedNavigationApp", provider);
        } else if (packages != null) {
            fallback.put("reason", "REQUESTED_NAVIGATION_APP_UNAVAILABLE");
            fallback.put("fallback", "REQUESTED_NAVIGATION_APP_UNAVAILABLE");
            fallback.put("requestedNavigationApp", provider);
        }
        return fallback;
    }

    private static Intent navigationIntent(String destination) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(destination)));
    }

    private static String[] navigationPackages(String provider) {
        switch (provider) {
            case "MAPS": return MAPS_PACKAGES;
            case "WAZE": return WAZE_PACKAGES;
            case "TOMTOM": return TOMTOM_PACKAGES;
            default: return null;
        }
    }

    private static JSObject openApp(Activity activity, String requestedLabel) {
        PackageManager manager = activity.getPackageManager();
        String needle = requestedLabel.toLowerCase(Locale.ROOT);
        if ("camera".equals(needle) || "kamera".equals(needle)) {
            Intent camera = new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
            return start(activity, camera, "CAMERA_APP_UNAVAILABLE");
        }
        Intent launcherQuery = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> matches = manager.queryIntentActivities(launcherQuery, 0);
        ResolveInfo exact = null;
        ResolveInfo partial = null;
        for (ResolveInfo candidate : matches) {
            String label = String.valueOf(candidate.loadLabel(manager)).trim();
            if (label.toLowerCase(Locale.ROOT).equals(needle)) { exact = candidate; break; }
            if (partial == null && label.toLowerCase(Locale.ROOT).contains(needle)) partial = candidate;
        }
        ResolveInfo selected = exact != null ? exact : partial;
        if (selected == null || selected.activityInfo == null) return result("UNAVAILABLE", "APP_NOT_FOUND", null);
        Intent launch = manager.getLaunchIntentForPackage(selected.activityInfo.packageName);
        if (launch == null) return result("UNAVAILABLE", "APP_HAS_NO_LAUNCHER", null);
        return start(activity, launch, "APP_LAUNCH_UNAVAILABLE");
    }

    private static JSObject share(Activity activity, String value, String contextText, String mimeType, String contentUri) {
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType(mimeType.isEmpty() ? "text/plain" : mimeType);
        String text = !contextText.isEmpty() ? contextText : value;
        if (!text.isEmpty()) share.putExtra(Intent.EXTRA_TEXT, text);
        if (!contentUri.isEmpty()) {
            Uri uri = Uri.parse(contentUri);
            if (!"content".equalsIgnoreCase(uri.getScheme())) return result("INVALID_INPUT", "CONTENT_URI_REQUIRED", null);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        if (text.isEmpty() && contentUri.isEmpty()) return result("INVALID_INPUT", "SHARE_PAYLOAD_REQUIRED", null);
        if (!hasHandler(activity.getPackageManager(), share)) return result("UNAVAILABLE", "NO_COMPATIBLE_ANDROID_HANDLER", null);
        try {
            activity.startActivity(Intent.createChooser(share, "Share with"));
            return result("OPENED", "ANDROID_CHOOSER_OPENED", "ANDROID_CHOOSER");
        } catch (Exception ignored) {
            return result("UNAVAILABLE", "ANDROID_CHOOSER_UNAVAILABLE", null);
        }
    }

    private static JSObject emailDraft(Activity activity, String recipient, String subject, String body) {
        Intent draft = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(recipient)));
        if (!subject.isEmpty()) draft.putExtra(Intent.EXTRA_SUBJECT, subject);
        if (!body.isEmpty()) draft.putExtra(Intent.EXTRA_TEXT, body);
        return start(activity, draft, "EMAIL_CLIENT_UNAVAILABLE");
    }

    private static JSObject messengerChat(Activity activity, String value) {
        String identifier = clean(value, 200);
        Uri uri;
        if (identifier.matches("(?i)^[a-z0-9._-]{2,80}$")) {
            uri = Uri.parse("https://m.me/" + Uri.encode(identifier));
        } else {
            Uri candidate = Uri.parse(identifier);
            String host = candidate.getHost();
            String path = candidate.getPath();
            if (!"https".equalsIgnoreCase(candidate.getScheme()) || host == null
                || !("m.me".equalsIgnoreCase(host) || "www.m.me".equalsIgnoreCase(host))
                || path == null || path.replace("/", "").trim().isEmpty()) {
                return result("INVALID_INPUT", "VALID_MESSENGER_CONTACT_REQUIRED", null);
            }
            uri = candidate;
        }

        Intent webIntent = new Intent(Intent.ACTION_VIEW, uri);
        Intent appIntent = new Intent(webIntent).setPackage(MESSENGER_PACKAGE);
        if (hasHandler(activity.getPackageManager(), appIntent)) {
            return start(activity, appIntent, "MESSENGER_APP_UNAVAILABLE");
        }
        JSObject fallback = start(activity, webIntent, "MESSENGER_APP_AND_WEB_UNAVAILABLE");
        if ("OPENED".equals(fallback.optString("status"))) {
            fallback.put("reason", "MESSENGER_APP_UNAVAILABLE_WEB_FALLBACK_OPENED");
            fallback.put("fallback", "MESSENGER_WEB");
        }
        return fallback;
    }

    private static String selectedAssistantPackage(Activity activity) {
        String flattened = Settings.Secure.getString(activity.getContentResolver(), "assistant");
        if (flattened == null || flattened.trim().isEmpty()) return null;
        ComponentName component = ComponentName.unflattenFromString(flattened);
        return component == null ? null : component.getPackageName();
    }

    private static JSObject start(Activity activity, Intent intent, String unavailableReason) {
        ActivityInfo target = intent.resolveActivityInfo(activity.getPackageManager(), PackageManager.MATCH_DEFAULT_ONLY);
        if (target == null) return result("UNAVAILABLE", unavailableReason, null);
        try {
            activity.startActivity(intent);
            String targetName = target.packageName + "/" + target.name;
            return result("OPENED", "ANDROID_INTENT_OPENED", targetName);
        } catch (Exception ignored) {
            return result("UNAVAILABLE", unavailableReason, null);
        }
    }

    private static boolean hasHandler(PackageManager manager, Intent intent) {
        return intent.resolveActivityInfo(manager, PackageManager.MATCH_DEFAULT_ONLY) != null;
    }

    private static boolean hasPackagedHandler(PackageManager manager, Intent baseIntent, String[] packageNames) {
        for (String packageName : packageNames) {
            if (hasHandler(manager, new Intent(baseIntent).setPackage(packageName))) return true;
        }
        return false;
    }

    private static JSObject result(String status, String reason, String target) {
        JSObject out = new JSObject();
        out.put("protocolVersion", "android-action-protocol.v1");
        out.put("requestId", UUID.randomUUID().toString());
        out.put("status", status);
        out.put("reason", reason);
        out.put("resolution", "OPENED".equals(status) ? "RESOLVED" : "UNRESOLVED");
        out.put("fallback", "OPENED".equals(status) ? "NONE" : reason);
        out.put("permission", "NOT_REQUIRED");
        out.put("observedAtEpochMs", System.currentTimeMillis());
        if (target != null) out.put("target", target);
        return out;
    }

    private static String clean(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
