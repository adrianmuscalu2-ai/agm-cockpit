import com.android.tools.build.bundletool.commands.BuildApksCommand;
import com.android.tools.build.bundletool.device.AdbServer;
import com.android.tools.build.bundletool.device.DdmlibAdbServer;
import com.android.tools.build.bundletool.flags.FlagParser;

import java.nio.file.Files;
import java.nio.file.Path;
import java.io.IOException;
import java.io.InputStream;
import java.security.Key;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.UnrecoverableKeyException;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Runs bundletool in-process so signing passwords never appear in the OS
 * process command line. Passwords are accepted only through the transient
 * environment of the controlled release process and are never printed.
 */
public final class SecureBundletoolRunner {
    private static Path statusPath;

    private SecureBundletoolRunner() {}

    public static void main(String[] args) {
        if (args.length != 7) {
            fail("SECURE_BUNDLETOOL_USAGE_INVALID");
        }

        Path bundle = Path.of(args[0]).toAbsolutePath().normalize();
        Path output = Path.of(args[1]).toAbsolutePath().normalize();
        Path keystore = Path.of(args[2]).toAbsolutePath().normalize();
        String alias = args[3];
        String expectedFingerprint = normalizeFingerprint(args[4]);
        statusPath = Path.of(args[5]).toAbsolutePath().normalize();
        Path aapt2 = Path.of(args[6]).toAbsolutePath().normalize();
        writeStatus("STARTED", "NONE");

        String storePassword = requiredEnvironment("AGM_ANDROID_RELEASE_STORE_PASSWORD");
        String keyPassword = requiredEnvironment("AGM_ANDROID_RELEASE_KEY_PASSWORD");
        if (!storePassword.equals(keyPassword)) {
            fail("KEYSTORE_CREDENTIAL_CHECK_PASSWORD_INPUTS_NOT_IDENTICAL");
        }
        if (!Files.isRegularFile(bundle)) fail("SECURE_BUNDLETOOL_AAB_NOT_FOUND");
        if (!Files.isRegularFile(keystore)) fail("SECURE_BUNDLETOOL_KEYSTORE_NOT_FOUND");
        if (!Files.isRegularFile(aapt2)) fail("SECURE_BUNDLETOOL_AAPT2_NOT_FOUND");
        if (alias == null || alias.isBlank()) fail("SECURE_BUNDLETOOL_ALIAS_MISSING");
        if (expectedFingerprint.length() != 64) fail("SECURE_BUNDLETOOL_EXPECTED_FINGERPRINT_INVALID");

        char[] storePasswordChars = storePassword.toCharArray();
        char[] keyPasswordChars = keyPassword.toCharArray();
        validatePkcs12(
                keystore,
                alias,
                storePasswordChars,
                keyPasswordChars,
                expectedFingerprint);
        writeStatus("KEYSTORE_CREDENTIAL_CHECK_PASS", "NONE");

        List<String> command = new ArrayList<>();
        command.add("build-apks");
        command.add("--bundle=" + bundle);
        command.add("--output=" + output);
        command.add("--mode=universal");
        command.add("--aapt2=" + aapt2);
        command.add("--overwrite");
        command.add("--ks=" + keystore);
        command.add("--ks-key-alias=" + alias);
        command.add("--ks-pass=pass:" + storePassword);
        command.add("--key-pass=pass:" + keyPassword);

        try {
            try (AdbServer adbServer = DdmlibAdbServer.getInstance()) {
                BuildApksCommand.fromFlags(
                                new FlagParser().parse(command.toArray(String[]::new)),
                                adbServer)
                        .execute();
            }
            writeStatus("PASS", "NONE");
        } catch (Throwable error) {
            fail("SECURE_BUNDLETOOL_FAILED:" + exceptionTypes(error) + ":"
                    + sanitizedError(error.getMessage(), storePassword, keyPassword));
        } finally {
            command.clear();
            Arrays.fill(storePasswordChars, '\0');
            Arrays.fill(keyPasswordChars, '\0');
            storePassword = null;
            keyPassword = null;
        }
    }

    private static String exceptionTypes(Throwable error) {
        StringBuilder types = new StringBuilder();
        Throwable current = error;
        for (int depth = 0; current != null && depth < 6; depth++) {
            if (depth > 0) types.append('>');
            types.append(current.getClass().getSimpleName());
            current = current.getCause();
        }
        return types.toString();
    }

    private static String sanitizedError(String message, String... secrets) {
        String sanitized = message == null ? "NO_MESSAGE" : message;
        for (String secret : secrets) {
            if (secret != null && !secret.isEmpty()) sanitized = sanitized.replace(secret, "[REDACTED]");
        }
        sanitized = sanitized
                .replaceAll("(?i)(pass:)[^\\s,;]+", "$1[REDACTED]")
                .replaceAll("(?i)(password\\s*[=:]\\s*)[^\\s,;]+", "$1[REDACTED]")
                .replaceAll("[\\r\\n\\t]+", " ")
                .trim();
        if (sanitized.length() > 500) sanitized = sanitized.substring(0, 500);
        return sanitized;
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) fail("SECURE_BUNDLETOOL_SECRET_INPUT_REQUIRED:" + name);
        return value;
    }

    private static void validatePkcs12(
            Path keystorePath,
            String alias,
            char[] storePassword,
            char[] keyPassword,
            String expectedFingerprint) {
        try {
            KeyStore keystore = KeyStore.getInstance("PKCS12");
            try (InputStream input = Files.newInputStream(keystorePath)) {
                keystore.load(input, storePassword);
            }
            if (!keystore.containsAlias(alias)) fail("KEYSTORE_CREDENTIAL_CHECK_ALIAS_NOT_FOUND");
            if (!keystore.isKeyEntry(alias)) fail("KEYSTORE_CREDENTIAL_CHECK_NOT_PRIVATE_KEY_ENTRY");
            Key key = keystore.getKey(alias, keyPassword);
            if (!(key instanceof PrivateKey)) fail("KEYSTORE_CREDENTIAL_CHECK_PRIVATE_KEY_UNREADABLE");
            Certificate certificate = keystore.getCertificate(alias);
            if (!(certificate instanceof X509Certificate)) {
                fail("KEYSTORE_CREDENTIAL_CHECK_CERTIFICATE_UNREADABLE");
            }
            String actualFingerprint = toHex(
                    MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
            if (!actualFingerprint.equals(expectedFingerprint)) {
                fail("KEYSTORE_CREDENTIAL_CHECK_CERTIFICATE_FINGERPRINT_MISMATCH");
            }
            System.out.println("KEYSTORE_CREDENTIAL_CHECK=PASS");
            System.out.println("KEYSTORE_FORMAT=PKCS12");
            System.out.println("KEY_ALIAS=" + alias);
            System.out.println("KEY_ENTRY_TYPE=PrivateKeyEntry");
            System.out.println("CERTIFICATE_FINGERPRINT_MATCH=PASS");
            System.out.println("SECRETS_PRINTED=false");
        } catch (IOException error) {
            fail("KEYSTORE_CREDENTIAL_CHECK_STORE_PASSWORD_REJECTED");
        } catch (UnrecoverableKeyException error) {
            fail("KEYSTORE_CREDENTIAL_CHECK_KEY_PASSWORD_REJECTED");
        } catch (Exception error) {
            fail("KEYSTORE_CREDENTIAL_CHECK_FAILED:" + error.getClass().getSimpleName());
        }
    }

    private static String normalizeFingerprint(String value) {
        return value == null ? "" : value.replace(":", "").trim().toUpperCase();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02X", value));
        return result.toString();
    }

    private static void fail(String message) {
        writeStatus("FAILED", message);
        System.err.println(message);
        System.exit(1);
    }

    private static void writeStatus(String state, String error) {
        if (statusPath == null) return;
        try {
            Files.createDirectories(statusPath.getParent());
            String json = "{\n"
                    + "  \"state\": \"" + jsonEscape(state) + "\",\n"
                    + "  \"error\": \"" + jsonEscape(error) + "\",\n"
                    + "  \"secretsPrinted\": false,\n"
                    + "  \"keystoreMutation\": \"NONE\",\n"
                    + "  \"aabMutation\": \"NONE\"\n"
                    + "}\n";
            Files.writeString(statusPath, json);
        } catch (Exception ignored) {
            // Status evidence must never alter the signing result.
        }
    }

    private static String jsonEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\r", "\\r").replace("\n", "\\n");
    }
}
