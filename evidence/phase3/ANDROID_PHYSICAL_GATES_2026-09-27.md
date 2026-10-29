# Android 1.6 physical gates

## Provenance

- Source HEAD: `5a85ed7797161fa0bc198c04b0e4b4354b90f69d`
- Source tree: `fcbee0f30c3ff7f78cad577acd83dac99c7a91cc`
- Device: Samsung `SM-S931B`, serial `RFCY70WDHXK`, Android 16 / SDK 36
- Isolated package: `com.agm.cockpit.storagetest`
- Version: `1.6.0-storage-test`, version code 28
- APK SHA-256: `FCB6015A1419230FB19ACC4D495CE225B177AA161C61159BF40B1680D6C06C1F`
- Installed APK SHA-256: identical
- Production-signed `com.agm.cockpit` was not replaced because its signature differs; its data was not removed.

## Results

- Native capability bridge: PASS (camera, TTS, speech recognition and on-device speech recognition available).
- Foreground voice: PASS (microphone granted; real start/stop cycle terminated safely).
- Contacts: PASS (permission granted; native resolver executed and returned a controlled NOT_FOUND for a synthetic name, without exposing contact data).
- Multiple email UI: PASS (personal/work rows, work default).
- Multiple email persistence/reload: PASS in isolated Android storage.
- Gmail/email draft handler: PASS.
- Messenger handler: PASS.
- Navigation: PASS; generic navigation plus Maps, Waze and TomTom handlers present.
- Car Mover: PASS for the physical WebView HERO/hub path and six-module hub. No Production job or financial record was created.
- Wi-Fi: PASS; validated active default transport before the transition.
- Mobile data: PASS; with Wi-Fi temporarily disabled, Android selected a cellular LTE network with INTERNET capability. Wi-Fi and mobile-data settings were restored to their original enabled state.
- OCR: native camera capability and current deterministic global OCR suite PASS. A fresh physical camera capture/OCR was not executed because it requires a real user capture; this remains a physical evidence gap, not a fabricated PASS.
- Confirmation/disambiguation: current deterministic confirmation, single-use, contact label/default and semantic disambiguation suites PASS; external apps were capability-probed but no message/email/navigation was sent.
- AGMa background wake: excluded by mandate.

Evidence: `evidence/phase3/android-physical/2026-09-27T09-16-02-956Z/`.

Production mutation: **NONE**. All API traffic in the isolated validator was fulfilled by local Playwright fixtures. No Production write was executed.

Verdict: **PHYSICAL ANDROID PASS for the non-camera-capture scope; OCR physical capture remains PARTIAL**.
