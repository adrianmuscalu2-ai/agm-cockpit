package com.agm.cockpit;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgmAudioPlugin.class);
        registerPlugin(AgmEmailPlugin.class);
        registerPlugin(AgmDiagnosticsPlugin.class);
        registerPlugin(AgmCapabilityPlugin.class);
        super.onCreate(savedInstanceState);
        CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }
}
