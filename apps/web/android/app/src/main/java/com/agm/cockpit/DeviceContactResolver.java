package com.agm.cockpit;

import android.app.Activity;
import android.database.Cursor;
import android.provider.ContactsContract;
import com.getcapacitor.JSObject;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class DeviceContactResolver {
    private static final int MAX_ROWS = 100;

    private DeviceContactResolver() {}

    static JSObject resolve(Activity activity, String name) {
        String requestedName = clean(name, 120);
        if (requestedName.isEmpty()) return result("INVALID_INPUT", "CONTACT_NAME_REQUIRED");

        String selectionName = requestedName.replace("%", "").replace("_", "").trim();
        if (selectionName.isEmpty()) return result("INVALID_INPUT", "CONTACT_NAME_REQUIRED");

        String[] projection = {
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        };
        String selection = ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " LIKE ? COLLATE NOCASE";
        String[] selectionArgs = { "%" + selectionName + "%" };
        Map<String, Candidate> candidates = new LinkedHashMap<>();

        try (Cursor cursor = activity.getContentResolver().query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " ASC"
        )) {
            if (cursor == null) return result("UNAVAILABLE", "CONTACT_PROVIDER_UNAVAILABLE");
            int contactIdIndex = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID);
            int displayNameIndex = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY);
            int numberIndex = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER);
            int rows = 0;
            while (cursor.moveToNext() && rows++ < MAX_ROWS) {
                String contactId = cursor.getString(contactIdIndex);
                String displayName = clean(cursor.getString(displayNameIndex), 160);
                String phoneNumber = clean(cursor.getString(numberIndex), 80);
                if (contactId == null || displayName.isEmpty() || phoneNumber.isEmpty()) continue;
                int score = matchScore(normalize(displayName), normalize(requestedName));
                if (score == 0) continue;
                Candidate existing = candidates.get(contactId);
                if (existing == null || score > existing.score) {
                    candidates.put(contactId, new Candidate(displayName, phoneNumber, score));
                }
            }
        } catch (SecurityException ignored) {
            return result("PERMISSION_DENIED", "CONTACTS_PERMISSION_REQUIRED");
        } catch (Exception ignored) {
            return result("UNAVAILABLE", "CONTACT_LOOKUP_FAILED");
        }

        int bestScore = 0;
        for (Candidate candidate : candidates.values()) bestScore = Math.max(bestScore, candidate.score);
        Candidate selected = null;
        int bestMatches = 0;
        for (Candidate candidate : candidates.values()) {
            if (candidate.score != bestScore) continue;
            selected = candidate;
            bestMatches++;
        }
        if (selected == null) return result("NOT_FOUND", "CONTACT_NOT_FOUND");
        if (bestMatches > 1) return result("AMBIGUOUS", "CONTACT_AMBIGUOUS");

        JSObject out = result("RESOLVED", "CONTACT_PHONE_RESOLVED");
        out.put("displayName", selected.displayName);
        out.put("phoneNumber", selected.phoneNumber);
        return out;
    }

    private static int matchScore(String displayName, String requestedName) {
        if (displayName.equals(requestedName)) return 3;
        if (displayName.startsWith(requestedName + " ")) return 2;
        if (displayName.contains(requestedName)) return 1;
        return 0;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{L}\\p{N}]+", " ")
            .trim();
    }

    private static JSObject result(String status, String reason) {
        JSObject out = new JSObject();
        out.put("status", status);
        out.put("reason", reason);
        return out;
    }

    private static String clean(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private static final class Candidate {
        final String displayName;
        final String phoneNumber;
        final int score;

        Candidate(String displayName, String phoneNumber, int score) {
            this.displayName = displayName;
            this.phoneNumber = phoneNumber;
            this.score = score;
        }
    }
}
