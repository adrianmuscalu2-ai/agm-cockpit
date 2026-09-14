package com.agm.cockpit;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

final class PermissionProtocol {
    private static final String STORE = "agm_permission_protocol_v1";

    private PermissionProtocol() {}

    static void markRequested(Context context, String permission) {
        store(context).edit().putBoolean("requested:" + permission, true).apply();
    }

    static void markObserved(Context context, String permission, boolean granted) {
        if (granted) {
            store(context).edit()
                .putBoolean("requested:" + permission, true)
                .putBoolean("granted:" + permission, true)
                .apply();
        }
    }

    static void markRequestResult(Context context, String permission, boolean granted) {
        SharedPreferences.Editor editor = store(context).edit()
            .putBoolean("requested:" + permission, true);
        if (granted) editor.putBoolean("granted:" + permission, true);
        editor.apply();
    }

    static String status(Activity activity, String permission) {
        SharedPreferences preferences = store(activity);
        boolean granted = activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            preferences.edit().putBoolean("granted:" + permission, true).apply();
            return "AUTHORIZED";
        }
        if (preferences.getBoolean("granted:" + permission, false)) return "REVOKED";
        if (!preferences.getBoolean("requested:" + permission, false)) return "NOT_PROVEN";
        return activity.shouldShowRequestPermissionRationale(permission) ? "DENIED" : "DENIED_DONT_ASK_AGAIN";
    }

    private static SharedPreferences store(Context context) {
        return context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }
}
