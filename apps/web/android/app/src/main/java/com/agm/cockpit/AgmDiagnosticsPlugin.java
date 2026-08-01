package com.agm.cockpit;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgmDiagnostics")
public class AgmDiagnosticsPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void collect(PluginCall call) {
        JSObject result = new JSObject();
        result.put("phoneModel", Build.MANUFACTURER + " " + Build.MODEL);
        result.put("androidVersion", Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")");
        result.put("connectionType", connectionType());

        try {
            PackageInfo packageInfo = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            result.put("appVersion", packageInfo.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                result.put("build", String.valueOf(packageInfo.getLongVersionCode()));
            } else {
                result.put("build", String.valueOf(packageInfo.versionCode));
            }
        } catch (Exception error) {
            result.put("appVersion", "necunoscută");
            result.put("build", "necunoscut");
        }

        call.resolve(result);
    }

    private String connectionType() {
        ConnectivityManager manager =
            (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return "necunoscut";

        Network network = manager.getActiveNetwork();
        if (network == null) return "offline";
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        if (capabilities == null) return "necunoscut";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "Wi-Fi";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "date mobile";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "Ethernet";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return "VPN";
        return "altă conexiune";
    }
}
