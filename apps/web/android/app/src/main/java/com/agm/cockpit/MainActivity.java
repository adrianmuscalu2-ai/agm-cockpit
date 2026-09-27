package com.agm.cockpit;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "AGMa-Activity";
    private static final int MAX_ASSISTANT_DISPATCH_ATTEMPTS = 40;
    private static final long ASSISTANT_DISPATCH_RETRY_MS = 250L;
    private final Handler assistantDispatchHandler = new Handler(Looper.getMainLooper());
    private int assistantDispatchGeneration = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgmAudioPlugin.class);
        registerPlugin(AgmEmailPlugin.class);
        registerPlugin(AgmDiagnosticsPlugin.class);
        registerPlugin(AgmCapabilityPlugin.class);
        super.onCreate(savedInstanceState);
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        cookieManager.flush();
        dispatchAssistantInvocation(getIntent());
    }

    @Override
    public void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
            "window.dispatchEvent(new Event('agm-native-resume'))",
            null
        ));
        dispatchAssistantInvocation(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchAssistantInvocation(intent);
    }

    private void dispatchAssistantInvocation(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(AgmaVoiceInteractionSessionService.EXTRA_ASSISTANT_SESSION, false)) return;
        String source = intent.getStringExtra(AgmaVoiceInteractionSessionService.EXTRA_INVOCATION_SOURCE);
        String safeSource = source == null ? "SYSTEM_ASSISTANT" : source.replaceAll("[^A-Z_]", "");
        if (getBridge() == null || getBridge().getWebView() == null) return;
        int generation = ++assistantDispatchGeneration;
        attemptAssistantInvocationDispatch(intent, safeSource, generation, 0);
    }

    private void attemptAssistantInvocationDispatch(Intent intent, String safeSource, int generation, int attempt) {
        if (generation != assistantDispatchGeneration || getBridge() == null || getBridge().getWebView() == null) return;
        String script = "(function(){try{if(typeof window.__agmaHandleAndroidAssistantInvocation!=='function')return 'NOT_READY';"
            + "return window.__agmaHandleAndroidAssistantInvocation('" + safeSource + "')?'HANDLED':'REJECTED';"
            + "}catch(error){return 'ERROR';}})()";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, result -> {
            if (generation != assistantDispatchGeneration) return;
            if ("\"HANDLED\"".equals(result)) {
                intent.removeExtra(AgmaVoiceInteractionSessionService.EXTRA_ASSISTANT_SESSION);
                Log.i(TAG, "Existing AGM voice runtime accepted Android assistant invocation from " + safeSource);
                return;
            }
            if (attempt + 1 >= MAX_ASSISTANT_DISPATCH_ATTEMPTS) {
                Log.e(TAG, "AGM web runtime did not accept Android assistant invocation: " + result);
                return;
            }
            assistantDispatchHandler.postDelayed(
                () -> attemptAssistantInvocationDispatch(intent, safeSource, generation, attempt + 1),
                ASSISTANT_DISPATCH_RETRY_MS
            );
        }));
    }
}
