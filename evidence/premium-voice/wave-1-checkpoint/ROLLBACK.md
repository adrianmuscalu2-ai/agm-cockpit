# Recovery procedure

Use a separate worktree so current user changes are never overwritten:

```powershell
git worktree add ..\AGM-premium-voice-wave-1 premium-voice-wave-1-pass-2026-08-12
```

Then install dependencies from the lockfile, build Web, synchronize Capacitor,
and run the Android `assembleDebug` task with the project JDK. Compare the
resulting behavior and configuration with `CHECKPOINT_MANIFEST.json`.

The accepted APK is archived outside Git because it is approximately 590 MB.
Verify it with SHA-256 before installation.
