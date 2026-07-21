# Advanced Message Library — validation protocol

Use the current debug APK and preserve the already validated Translator, Camera/OCR,
dictation, and Email Assistant flows throughout the test.

## Categories and languages

1. Open Email Assistant, select **General**, and open the message library.
2. Verify Transport, Clients, Logistics, Documents, and Emergencies.
3. Select at least two templates from every category.
4. For each selected template, switch the result language between Romanian, German,
   and English. Confirm that subject and body change together and remain professional.
5. Verify Romanian and German diacritics in both AGM preview and the Android mail client.

## Variables

1. Select a template containing variables.
2. Fill every displayed field, including vehicle, location, date/time, transport number,
   document name, price, or operational details as applicable.
3. Confirm that every placeholder is replaced consistently in subject and body.
4. Edit the generated subject and body manually and confirm that sending uses the final
   edited version. Never send a draft that still contains `{{variable}}` placeholders.

## Search, favorites, and recent messages

1. Search by a word from the subject and by a word from the body.
2. Confirm that diacritic-insensitive search finds the expected templates.
3. Add and remove a favorite, close/reopen AGM, and confirm persistence.
4. Use more than eight templates and confirm that **Recently used** keeps the newest
   eight without duplicates.

## Governance and regression

1. Open the official agent registry and confirm that **Linguistic Librarian** appears as
   planned. It must not publish or alter templates automatically.
2. Complete a message through the mandatory review and Android email handoff.
3. Repeat one translation, dictation, Camera/OCR capture, and manually composed email.
4. Confirm no crash, freeze, lost recipient, changed formatting, or regression.

The module passes when all five categories, RO/DE/EN content, variables, search,
favorites, recent history, email handoff, and existing AGM flows behave correctly.
