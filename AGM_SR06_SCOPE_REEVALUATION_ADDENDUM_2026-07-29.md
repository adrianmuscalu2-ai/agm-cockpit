# AGM — SR-06 Scope Reevaluation Addendum

Date: 2026-07-29  
Basis: Operational clarification excluding the unpublished public Website from SR-06  
Reevaluated verdict: **SR-06 — HOLD (single remaining finding)**

## 1. Scope correction

The separate public AGM Cockpit Website is intentionally local-only and unpublished.

Consequently:

- absence of a public Website domain is not an SR-06 defect;
- Website publication is not an SR-06 acceptance criterion;
- Website publication and domain validation remain a future, separately mandated activity;
- the relevant official platform address is `https://app.agmcockpit.com/`.

The Website-address finding from the initial Final Device Validation report is therefore removed from the SR-06 verdict.

## 2. Meaning of `Basic 1.2.6`

The active Home header contains this literal:

```text
Basic 1.2.6
```

Source location:

- `apps/web/src/main.ts`, Home header renderer.

The synchronized Android asset embedded in the installed candidate contains the same literal.

There is no separate version contract, constant or metadata field establishing `1.2.6` as the current version of an independently versioned Basic module.

Historical distribution evidence instead identifies it as the previous Android application version:

- the distribution page title is `Android 1.2.6`;
- its APK link is `AGM-Cockpit-Android-1.2.6.apk`;
- its tester instruction explicitly requires `BASIC 1.2.6` to appear at the top.

Conclusion: **`Basic 1.2.6` is an active legacy application/distribution reference, not a validated independent module version.**

## 3. Correct application version

The canonical runtime constant is:

```text
A.G.M. Cockpit 1.2.9
```

It is used in:

- the application footer;
- the About header;
- the About version card;
- Legal version information;
- Roadmap version information;
- Licenses/version information;
- Turn Command Center metadata;
- Diagnostics and `AdminIncidentReportV1`.

The Android package manager independently confirms:

- `versionCode=15`;
- `versionName=1.2.9-sr06-final`.

APK inspection confirms that the approved artifact embeds both:

- `A.G.M. Cockpit 1.2.9`;
- `Basic 1.2.6`.

Therefore the package identity and canonical application version are correct, but the Home header is inconsistent with them.

## 4. Reevaluated SR-06 verdict

All validated Android criteria remain PASS:

- unique installation;
- package identity;
- application launch and stability;
- Translator;
- Diagnostics access control;
- `AdminIncidentReportV1`;
- standardized and masked report generation;
- external e-mail handoff;
- live Internet/API/AI/Translation states;
- controlled offline behavior;
- automatic recovery;
- official Web Application address `https://app.agmcockpit.com/`.

The public Website is excluded from this verdict.

The sole remaining blocking finding is:

> The active Home header displays the legacy Android/distribution identity `Basic 1.2.6`, while the installed and canonical application identity is `A.G.M. Cockpit 1.2.9` / `1.2.9-sr06-final`.

Final reevaluated status:

- **SR-06 — HOLD**
- General audit closure: **not yet authorized**
- `AGM v1.2.9 Stable Baseline`: **not yet constituted**

No code, configuration, APK, installation, API, DTO, Prisma, Diagnostics or infrastructure change was performed during this clarification.
