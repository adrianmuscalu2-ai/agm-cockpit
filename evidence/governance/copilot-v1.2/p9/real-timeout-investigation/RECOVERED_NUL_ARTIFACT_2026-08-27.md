# Recovered Windows `NUL` artifact

- Investigated: 2026-08-27
- Original path: `C:\Users\adria\Documents\AGM\NUL`
- Preserved path: `recovered-orphan-20260814T043043Z-batch-001.json`
- Size: 50,010 bytes
- SHA-256 before and after relocation: `A91AAD97F957D6349DB4A1E2B61BA4F0461486D3DDED70EAED0BFFDF8A76E6BE`
- Evidence contract: `agm-real-basic-timeout-correlated-probe.v1`
- Evidence timestamp: `2026-08-14T04:30:43.277Z`
- Result represented by the payload: `PASS_WITHIN_OFFICIAL_SLO` for batch 1, with 9 requests, 0 failures, and 0 timeouts.

## Root cause and disposition

The file was not an empty Windows placeholder. It contained the JSON response emitted by the diagnostic flush-and-stop endpoint. Three PowerShell diagnostics passed the Windows device name `NUL` to `curl.exe --output`. In this execution context, curl created an ordinary root-level file instead of discarding the response.

No evidence was deleted. The exact byte stream was moved into the matching real-timeout evidence directory and its hash was verified unchanged. All three calls now write the discarded response to an operating-system temporary file and remove only that file in `finally`.
