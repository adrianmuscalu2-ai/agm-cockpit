# Camera/OCR validation — HTTPS APK

Use the current debug APK from `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.
Record the phone model, Android version, APK version, connection type, source language,
target language, and the exact status message for every failed step.

## Test documents

Prepare three flat, well-lit printed pages containing 3–6 lines of Romanian, German,
and English text. Also prepare one intentionally blurred or poorly lit photograph.
Do not use confidential documents: OCR images and successful OCR/translation history
are stored locally on the phone until the history is cleared.

## Test sequence

1. Open A.G.M. Cockpit, enter Translator, and tap **Camera OCR**.
2. On the first run, grant camera permission. Confirm that the rear camera or Android
   image-capture screen opens. Cancel once and confirm that the app remains responsive.
3. Open Camera OCR again and confirm that Android does not request an already granted
   permission a second time. If permission was denied, grant it from Android App info
   before continuing and record the behavior.
4. Photograph the Romanian page in portrait orientation and accept the image.
5. Confirm that the app shows the processing status, then the document preview and OCR
   confidence. Verify the extracted text against the page, including diacritics.
6. Confirm that the extracted text is automatically placed in **Text to translate**.
7. Select a different target language and tap **Translate**. Confirm a non-empty,
   meaningful translation and that the application stays responsive.
8. Repeat steps 4–7 with the German and English pages and once in landscape orientation.
9. Submit the blurred/poorly lit image. Accept only a clear no-text, low-quality, or OCR
   failure message; corrupted text must not replace the translator input.
10. After OCR, use Translate, Listen, Copy, Clear, and ordinary manual translation.
    Confirm there is no crash, freeze, unexpected close, or degraded translator behavior.

## Network matrix

Run the complete good-image flow once on Wi-Fi. Disable Wi-Fi, verify that the phone is
using mobile data, restart the app, and repeat it. OCR processing and transfer should
complete; translation must reach the configured HTTPS API on both connections. Record
the exact message and time if either operation fails or takes more than 60 seconds.

## Permission persistence

After the successful first run, force-close and reopen the app, then repeat Camera OCR.
Restart the phone and repeat once more. The granted permission should remain available
unless Android or the user revoked it. Also test one denial: the app must stay responsive;
Android settings are the recovery path if the capture screen no longer opens.

## Pass criteria

- Camera capture opens from Camera OCR and returns a photograph to the app.
- Permission survives app relaunch and phone restart.
- Clear documents produce recognizable text with no material omissions.
- Usable OCR text appears automatically in the translator and can be translated.
- Wi-Fi and mobile-data flows both work through HTTPS.
- Bad images produce a clear localized status and do not inject corrupted text.
- Cancellation, denial, OCR failure, and translation failure do not crash or freeze the app.
- Manual translation and the other translator controls still work after Camera OCR.

For every failure, attach a screenshot or screen recording and note the document language,
lighting, orientation, connection, OCR confidence, and whether retrying succeeded.
