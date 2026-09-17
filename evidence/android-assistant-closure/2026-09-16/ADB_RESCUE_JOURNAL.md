# ADB session attachment rescue journal

Date: 2026-09-16 (Europe/Berlin)

## Frozen PASS evidence

- Production run `35056202884`: PASS.
- Guardian pre-action allow and deny controls: PASS.
- Camera system-intent correction on the signed APK: PASS.
- AGM session persistence after a real phone restart: PASS.
- Gmail read and Romanian TTS on the signed APK before restart: PASS.
- Controlled Browser confirmation, Gmail response, TTS, and source separation: PASS.

## Blocker

`SESSION ATTACHMENT FAILURE`: Windows reports the Samsung USB composite,
MTP, modem, and Android ADB interfaces as present and healthy, while
`adb devices -l` returns no transport.

## Recovery attempts

1. Standard ADB server restart on port 5037: server started; no device.
2. User performed a legitimate USB reconnect and USB-debugging/RSA cycle:
   Windows enumerated the interfaces; ADB still returned no device.
3. Isolated PnP restart of the exact Samsung ADB interface: Windows denied the
   administrative operation; no product or phone state was changed.
4. Process/configuration audit found one standard server on port 5037 and one
   orphaned historical server on port 5038. The orphan had no parent process.
5. The orphaned 5038 server was stopped, then the standard 5037 server was
   restarted: no device.
6. A fresh server was started on the historically configured port 5038:
   no device.
7. Existing Wireless Debugging discovery was checked on both server ports:
   no mDNS service was advertised.

## Classification and next action

Cause classification: local USB/driver session attachment, outside AGM product
code. No code change, dependency installation, key revocation, security bypass,
or speculative driver replacement is justified.

The remaining bounded recovery is a physical USB re-enumeration using another
data-capable port or cable, followed by the minimal `adb devices -l` probe.
All accepted PASS evidence remains frozen.

## Recovery result

The Samsung transport later reattached legitimately on the standard ADB port
5037 as `RFCY70WDHXK device product:pa1qxeea model:SM_S931B`. No driver,
dependency, permission, or security-boundary change was required.

`SESSION ATTACHMENT FAILURE = RECOVERED`

Control returned to the Android closure validation and only the affected
physical-device checks were resumed.
