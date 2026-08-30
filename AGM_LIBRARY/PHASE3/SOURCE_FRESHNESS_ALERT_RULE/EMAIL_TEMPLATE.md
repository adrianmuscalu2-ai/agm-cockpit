# Product Owner source alert email

Subject:

`[AGM SOURCE ALERT] <STATUS> — <SourceId>`

Body:

```text
SourceId: <SourceId>
Country / domain: <country> / <domain>
Authority: <authority>
Source title: <title>
Current effective period: <effectiveFrom or NOT_EXPLICIT> -> <effectiveUntil or NOT_EXPLICIT>
Detected new version / expiry condition: <condition>
Official URL: <officialUrl>
Current artifact SHA-256: <sha256>
New candidate URL/version: <candidate URL/version or N/A>
Estimated impact: <impact>
Required Product Owner action: <action>
Timestamp: <ISO-8601 timestamp>
Review package: <path/link>
```

Recipients are read only from the comma/semicolon-separated `AGM_PRODUCT_OWNER_ALERT_EMAIL` list, normalized and deduplicated. Missing destination yields `EMAIL_DESTINATION_NOT_CONFIGURED`; no address is inferred.
