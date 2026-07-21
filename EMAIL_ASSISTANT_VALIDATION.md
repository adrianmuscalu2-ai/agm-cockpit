# Email Assistant validation — HTTPS APK

Use the APK at `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.
Record the phone model, Android version, selected mail client, APK hash, connection,
source language, target language, and the exact status message for every failure.

Use a test recipient controlled by the tester. Do not send personal or confidential data.
Opening the mail client does not send automatically; the user remains responsible for the
final review and the mail client's Send action.

## Translator-to-email flow

Run this sequence once for Romanian, German, and English:

1. Translate a 3–5 line text containing language-specific characters, for example
   `ă â î ș ț`, `ä ö ü ß`, and punctuation.
2. Tap **Create email** in Translator.
3. Confirm that Email Assistant opens and that the translated text is present in the
   editable message field without missing characters or changed line breaks.
4. Enter the controlled recipient address and a subject containing diacritics.
5. Edit the body: add a line, remove a word, and add another Unicode character.
6. Confirm that the live preview reflects recipient, subject, language, edited body,
   salutation, spacing, and signature correctly.
7. Tap **Check/Send**, review the mandatory confirmation, and confirm it.
8. Confirm that the phone's mail application opens with the exact recipient, subject,
   body, paragraph breaks, and diacritics. Return to AGM without sending if desired.
9. Confirm that AGM is still responsive and Translator, Camera/OCR, Copy, and Listen
   continue to work.

## Template and contacts flow

1. Open Email Assistant directly, select General mode, and choose a template.
2. Confirm that subject and body are populated in the selected result language.
3. Select a saved contact and confirm that the exact e-mail address is populated.
4. Edit recipient, subject, and message and repeat the review/open-mail-client flow.
5. Test invalid recipient, missing subject, and empty body separately. The security check
   must block each case with a clear localized message.

## No configured mail client

On a device/profile without a configured mail application, complete a valid draft and
confirm it. AGM must show that no mail client is configured and must remain responsive.
If Android still offers an unconfigured mail application, record that Android behavior;
AGM can detect the absence of a handler, while account configuration is controlled by
the selected mail application.

## Network matrix

Repeat translator-to-email once on Wi-Fi and once on mobile data, restarting AGM between
runs. Translation must use the HTTPS API on both connections. Draft editing and opening
the installed mail client are device-local; actual sending and account errors belong to
the selected mail application and should be reported separately.

## Pass criteria

- A translated result transfers automatically into an editable Email Assistant draft.
- Recipient, subject, edited body, spacing, line breaks, and Unicode survive the handoff.
- Romanian, German, and English flows produce coherent previews and mail drafts.
- A valid draft opens an Android mail handler only after explicit review confirmation.
- Missing/invalid fields and absence of a mail handler produce clear messages.
- Wi-Fi and mobile-data translation both work through HTTPS.
- Returning from the mail client leaves AGM and its previously validated modules stable.
