# Unique AGM audio log classification

## Source authority

- Protected worktree: `_codex_stage_premium_assistant_compat_20260913`
- Repository-relative source inside that worktree: `evidence/speech-semantics/android-production/2026-09-13T08-12-44Z/agm-audio.log`
- Size: `1,762` bytes
- Lines: `18`
- SHA-256: `D65EF8071B5EE4C0B52C3C850DE729EE999E957854263FDA139F92F425F4FC37`
- Last-write UTC: `2026-09-13T08:38:31.7666827Z`

## Classification

- Unique functional evidence: **YES**, for the historical physical Android audio lifecycle run.
- Diagnostic-only evidence: **YES**; it contains lifecycle events, recognizer selection/fallback, TTS focus/start/completion and Android recognizer error codes.
- Secrets: **NONE DETECTED**.
- PII / recognized speech text: **NONE DETECTED**.
- Raw audio: **NONE**.
- Reproducible/generated: **PARTIALLY**; the log format is reproducible, but the exact physical-device timestamps, fallback and error sequence are unique historical evidence.

The log records an on-device recognizer attempt, one fallback to the Android default recognizer, speech detection, bounded endpoint stop, and error codes 12 and 7. It does not contain the spoken text, credentials, tokens, email addresses, phone numbers or raw microphone content.

## Preservation decision

**KEEP.** The exact source remains intact in the protected worktree. This normalized classification preserves its hash and semantic provenance without publishing an absolute local path or copying raw runtime evidence into the candidate. The source worktree remains protected and is not eligible for removal under this mandate.
