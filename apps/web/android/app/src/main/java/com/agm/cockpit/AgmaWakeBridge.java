package com.agm.cockpit;

/** Optional pilot hook; release builds retain the existing audio implementation. */
final class AgmaWakeBridge {
    private AgmaWakeBridge() { }
    static void stopIfPresent() {
        try { Class.forName("com.agm.cockpit.AgmaWakeService").getMethod("stopDetector").invoke(null); }
        catch (ClassNotFoundException ignored) { }
        catch (Exception error) { android.util.Log.w("AGM-Wake", "Could not stop pilot wake service", error); }
    }
    static boolean yieldMicrophone() {
        try {
            return (Boolean) Class.forName("com.agm.cockpit.AgmaWakeService").getMethod("pauseDetector").invoke(null);
        } catch (ClassNotFoundException ignored) { return true; }
        catch (Exception error) { return false; }
    }
}
