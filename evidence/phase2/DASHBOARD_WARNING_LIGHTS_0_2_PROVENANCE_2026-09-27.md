# Dashboard Warning Lights 0.2.0 - provenance gate

## Scope

This gate covers only WL-011 through WL-014 from commit
`80107b9d57482e8631e3de61bef5a36cfd228203`. No Dashboard application data,
runtime, visual asset, or Production configuration was changed.

## Direct official-source checks

Checked at `2026-09-27T07:42:26Z`.

| Source | Result | Evidence | Decision |
| --- | --- | --- | --- |
| `MAN-TG3-002` - `https://public.man.eu/media/service/asp/media/en/615901.pdf` | FAIL | HTTP 303 redirects to the MAN error portal with `errorCode=404`; the response is a 3,372-byte HTML error page, not the declared PDF. | Reject as a publication source. |
| `MAN-TG3-001` - MAN TG3 breakdown/recovery/towing PDF | REACHABLE / INSUFFICIENT LOCATOR | HTTP 200, PDF, 18,554,109 bytes, SHA-256 `C5651D8E74A29F26AE25A8F86DA7D78518F3DC506EC10C28A1037497E1CD36DF`. Its declared title and scope do not establish the precise check-lamp/message locators claimed for WL-011, WL-012, and WL-014. | Keep as an existing reference; do not infer missing warning-light meaning from it. |
| `SCANIA-DRV-001` - Scania Driver's Manual portal | PASS for WL-013 | HTTP 200, official Scania page, 223,305 bytes, SHA-256 `5324E23EE63DD3C394F03077DA5FF4F181BAC931802B6D1AB02BCBFF32D5219F`. The `Automatic Emergency Braking` section states that AEB uses a forward-looking camera and distance sensor, may be limited/deactivated when either is blocked or defective, and displays a message when dirt, snow, or ice blocks them. | Sufficient provenance for the limited-AEB/camera/sensor facts in WL-013. |
| `UNECE-R121-001` | Existing canonical source only | It supports standardized ABS malfunction identification, but it does not by itself establish the MAN-specific trailer message or operating response in WL-012. | Retain as identification-only; insufficient alone for WL-012. |

## Per-entry verdict

| Entry | Provenance verdict | Reason |
| --- | --- | --- |
| WL-011 | BLOCKED | Its only locator is the invalid `MAN-TG3-002` message C3 reference. |
| WL-012 | BLOCKED | UNECE supports generic ABS identification, but the MAN-specific trailer behavior and operational wording lack a verified official locator. |
| WL-013 | SOURCE VERIFIED | The live official Scania AEB section supports the camera/sensor limitation statements. It remains unported because the Dashboard family must stay atomic. |
| WL-014 | BLOCKED | The broad MAN recovery manual reference does not prove the claimed air-suspension/running-height procedure. |

## Gate decision

`DASHBOARD WARNING LIGHTS 0.2.0 BLOCKED - MAN provenance unresolved for WL-011, WL-012, and WL-014.`

The family is not partially published. No meanings, thresholds, icons, or
vehicle-specific procedures were invented. The smallest required follow-up is
an official, reachable manufacturer source with stable section/page locators
for those three entries.
