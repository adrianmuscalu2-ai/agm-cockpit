# AGM AI Operational Cost Audit

Date: 2026-07-17
Status: decision audit only; no provider, model, or application change approved
Scope: current AGM Basic AI costs and planning thresholds for public launch

## Executive decision

AGM Basic currently has one AI service billed directly to the project: text
translation through the OpenAI Responses API using `gpt-4.1-mini`.

OCR runs locally through Tesseract.js. Android dictation and voice playback use the
device speech recognizer and text-to-speech engine. These functions currently produce
no metered AGM API charge.

For development, initial public launch, and the modeled range up to 1,000 active
users, **OpenAI Standard Pay-As-You-Go is the recommended commercial model**.

ChatGPT Business and ChatGPT Enterprise subscriptions do not include API usage for an
application. OpenAI Scale Tier is designed for Enterprise capacity, latency, and SLA
requirements and is financially disproportionate to the modeled AGM Basic traffic.

Expected translation cost at the baseline assumptions:

```text
USD 0.00034 per translation
USD 0.00102 per three-translation session
USD 0.068 per active user/month at 200 translations
USD 68/month at 1,000 active users
```

A 20% planning reserve raises the 1,000-user budget to approximately USD 81.60/month.
Cloud/VPS, tax, payment exchange rate, domain, and Premium AI costs are separate.

## 1. Current AI and automation inventory

| Function | Current implementation | Where it runs | AGM metered cost |
|---|---|---|---:|
| Text translation | OpenAI Responses API, `gpt-4.1-mini` | AGM backend/OpenAI | Yes |
| OCR | Tesseract.js 7, RO/DE/EN models | Android/browser device | USD 0 API |
| Dictation | Android `SpeechRecognizer` or browser speech recognition | Device/platform service | USD 0 AGM API |
| Voice playback | Android `TextToSpeech` or browser speech synthesis | Device/platform service | USD 0 AGM API |
| Text correction | Local application rules/agents | Device | USD 0 API |
| Email drafting/templates | Local templates and application logic | Device | USD 0 API |
| Email projection | Android intent or `mailto:` | Device/external mail app | USD 0 API |

The translated output of OCR or dictation is a normal OpenAI translation request and
is therefore billed once. OCR and dictation themselves are not billed by the AGM
backend.

Device speech services can require network access depending on the installed Android
engine and device settings. Any carrier data or platform conditions belong to the
device ecosystem, not to the current AGM OpenAI account.

No other server-side AI, vision, transcription, embeddings, vector search, speech
generation, or realtime voice provider was found in the current source.

## 2. Current pricing model

The backend sends each translation synchronously to:

```text
POST https://api.openai.com/v1/responses
model: gpt-4.1-mini
```

Published Standard API rates on the audit date:

| Token category | Price per 1 million tokens |
|---|---:|
| Input | USD 0.40 |
| Cached input | USD 0.10 |
| Output | USD 1.60 |

The current request does not explicitly select Priority or Scale service. It therefore
uses the normal API service and is charged by consumed tokens.

### Cost formula

```text
request cost =
  input tokens / 1,000,000 * USD 0.40
  + output tokens / 1,000,000 * USD 1.60
```

The source does not currently persist the `usage` fields returned by OpenAI. The
project therefore has request durations but not a trustworthy historical cost per
translation, language pair, or user.

## 3. Planning assumptions

The following assumptions are intentionally conservative enough for planning but must
be replaced by measured data before commercial pricing is finalized:

| Variable | Baseline assumption |
|---|---:|
| Input tokens per translation | 250 |
| Output tokens per translation | 150 |
| Translations per session | 3 |
| Active days per user/month | 20 |
| Translations per active day | 10 |
| Translations per active user/month | 200 |
| Financial planning reserve | 20% |

The input estimate includes system instructions, language wrapper, and user text. The
output estimate represents the translated text. Long documents can be several times
more expensive; very short messages can be cheaper.

At these assumptions:

```text
input cost       = 250 / 1,000,000 * 0.40 = USD 0.00010
output cost      = 150 / 1,000,000 * 1.60 = USD 0.00024
translation cost = USD 0.00034
session cost     = 3 * 0.00034 = USD 0.00102
user/month       = 200 * 0.00034 = USD 0.068
```

Prompt caching is not included in the forecast. Short translation requests should not
be budgeted on the assumption that caching will always apply.

## 4. Cost simulations

### Baseline usage

| Scenario | Translations/month | Raw AI/month | Budget +20%/month | Raw AI/year | Budget +20%/year |
|---|---:|---:|---:|---:|---:|
| Current development | 1,000 | USD 0.34 | USD 0.41 | USD 4.08 | USD 4.90 |
| 10 active users | 2,000 | USD 0.68 | USD 0.82 | USD 8.16 | USD 9.79 |
| 100 active users | 20,000 | USD 6.80 | USD 8.16 | USD 81.60 | USD 97.92 |
| 1,000 active users | 200,000 | USD 68.00 | USD 81.60 | USD 816.00 | USD 979.20 |

These values cover current text translation only. They do not include VPS costs or
future Premium functions.

### Usage sensitivity per active user

| Usage profile | Translations/user/month | Cost/user/month | Cost for 1,000 users/month |
|---|---:|---:|---:|
| Light: 5/day for 20 days | 100 | USD 0.034 | USD 34.00 |
| Baseline: 10/day for 20 days | 200 | USD 0.068 | USD 68.00 |
| Heavy: 30/day for 20 days | 600 | USD 0.204 | USD 204.00 |

With a 20% reserve, the heavy 1,000-user case should be budgeted at approximately
USD 244.80/month.

### Long-text sensitivity

| Request profile | Input/output tokens | Cost/translation |
|---|---:|---:|
| Baseline | 250 / 150 | USD 0.00034 |
| Medium document | 1,000 / 900 | USD 0.00184 |
| Long document | 4,000 / 3,500 | USD 0.00720 |

One thousand long-document translations would cost approximately USD 7.20, compared
with USD 0.34 for one thousand baseline translations.

## 5. Subscription and contracted options

### ChatGPT Business

ChatGPT Business is a seat-based workspace product for people using ChatGPT. It is
separate from the API Platform and does not include application API usage.

Result for AGM:

- useful if the internal team separately needs a managed ChatGPT workspace;
- does not pay for translations performed by the AGM APK;
- cannot be shared with application users or used to power a public service;
- not an alternative to API Pay-As-You-Go.

### ChatGPT Enterprise

ChatGPT Enterprise is also a human workspace product unless a separate API contract
is negotiated. A ChatGPT Enterprise subscription alone does not create an included
translation pool for AGM.

Potential value:

- internal governance and enterprise workspace controls;
- separate contractual discussions for API invoicing, data controls, or support.

It should not be purchased to reduce AGM Basic API token cost.

### API Enterprise contract

OpenAI states that organizations with approximately USD 10,000 or more in monthly API
spend can contact Sales regarding an API Enterprise contract.

Potential advantages:

- contracted billing and payment terms;
- negotiated annual commitments or discounts;
- enterprise support and eligible data-control options;
- access to Scale Tier and SLA-backed offerings.

Limitations:

- commercial terms and discounts are not publicly guaranteed;
- commitment risk if actual usage is below forecast;
- current AGM Basic spend is far below the indicated sales threshold.

### Scale Tier

Scale Tier purchases dedicated token-per-minute units for at least 30 days and is
available to Enterprise customers. For `gpt-4.1-mini`, the published minimum input and
output units together are:

```text
USD 450/day input unit
USD 175/day output unit
USD 625/day combined
approximately USD 18,750 per 30-day month
```

This buys capacity, predictable latency, and a 99.9% uptime SLA. It is not a small
consumer subscription with inexpensive included translations.

At the baseline USD 0.00034 translation estimate, USD 18,750 equals the Standard PAYG
cost of roughly 55 million translations per month. The real decision would also depend
on peak tokens per minute, SLA value, and negotiated commitment discounts.

Scale Tier is not justified for 1,000 AGM Basic users under the current forecast.

### Priority Processing

Priority Processing is per-request Pay-As-You-Go with more predictable latency. For
`gpt-4.1-mini`, published Priority prices are USD 0.70/M input and USD 2.80/M output,
approximately 1.75 times the Standard token rates.

Baseline translation cost would rise from:

```text
Standard: USD 0.00034
Priority: USD 0.000595
```

Priority may be useful selectively for paid Premium workflows with strict latency
requirements. It is not a cost-saving plan.

### Batch API

Batch processing provides a 50% token discount but returns results within a 24-hour
completion window. It is unsuitable for the live Translator, where the user expects an
immediate result.

It can later reduce costs for:

- offline evaluations;
- nightly knowledge-base processing;
- non-urgent document classification;
- bulk back-office jobs.

## 6. Commercial model comparison

| Model | Best use | Advantages | Limitations | AGM decision |
|---|---|---|---|---|
| Standard PAYG | Interactive Basic/Premium | No commitment, low unit cost, immediate | Variable bill, no purchased SLA | Recommended |
| ChatGPT subscription | Human team workspace | Fixed seat price, admin workspace | No API usage included | Not a runtime solution |
| Priority PAYG | Selected latency-sensitive calls | More predictable speed | About 1.75x current rates | Future selective option |
| Batch | Asynchronous back-office jobs | 50% discount | Up to 24 hours, not interactive | Future hybrid component |
| Scale Tier | Very high sustained Enterprise traffic | Capacity and 99.9% SLA | About USD 18,750/month minimum for current model input+output units | Not justified |
| Negotiated API contract | About USD 10k+/month or special governance needs | Contract terms, possible commitments/discounts | Sales process and commitment | Reassess much later |

## 7. Recommended model by project stage

### Current development

Use Standard Pay-As-You-Go with:

- one dedicated OpenAI project for AGM development;
- a low monthly budget alert;
- no automatic model switching;
- no Scale Tier, Priority default, or ChatGPT subscription attribution;
- synthetic monitoring traffic identified separately.

Planning budget: **USD 1-5/month** for normal Basic development, unless long-document
stress testing is intentionally increased.

### Initial public launch

Keep `gpt-4.1-mini` Standard PAYG until quality and cost telemetry provide evidence for
a change.

Required financial controls before launch:

- capture input, cached-input, and output tokens from each provider response;
- attach request ID, module, language pair, text-length band, latency, and success;
- do not log translated personal text;
- dashboard daily/monthly tokens and cost;
- per-user and per-device rate limits;
- abuse controls and maximum text length;
- project soft/hard spending thresholds where supported;
- alerts at 50%, 75%, 90%, and 100% of budget;
- separate development, staging, production, and synthetic-monitoring projects/keys.

Initial planning envelope:

- 100 active users: approximately USD 8.16/month including reserve;
- 1,000 active users: approximately USD 81.60/month including reserve;
- heavy 1,000-user usage: approximately USD 244.80/month including reserve.

### Premium growth

Use a hybrid processing policy, not a seat subscription:

- Standard PAYG for interactive translation and ordinary assistant requests;
- Batch for non-urgent ingestion, evaluation, and background processing;
- Priority only for measured latency-sensitive paid workflows;
- distinct model budgets by Premium module;
- Enterprise discussion only when spend, compliance, or SLA requirements justify it.

This hybrid model changes request routing by workload type, not AGM's public functional
architecture.

## 8. Decision thresholds

The move away from Standard PAYG should not be based only on user count.

| Trigger | Required review |
|---|---|
| USD 100/month API spend | Validate token telemetry, abuse limits, and unit economics |
| USD 500/month | Review model routing, prompt size, caching evidence, and Batch candidates |
| USD 2,000/month | Request provider forecast and compare contracted alternatives |
| Approximately USD 10,000/month | Contact OpenAI Sales regarding API Enterprise terms |
| Sustained high TPM or paid SLA requirement | Compare Priority and Scale Tier regardless of monthly average |
| New voice/vision/document module | Create a separate cost model before implementation |

There is no public break-even point at which ChatGPT Business seats become cheaper for
the AGM application because those seats do not include API consumption.

Scale Tier becomes a capacity/SLA candidate only at very large sustained traffic. Its
published combined minimum is more than 200 times the modeled 1,000-user Basic monthly
cost with reserve.

## 9. Premium cost risks not included

The following proposed capabilities can dominate future costs:

- realtime voice input/output and long sessions;
- server-side speech transcription and synthesis;
- photo/vision analysis for load securing or dashboard warnings;
- document and PDF analysis;
- embeddings, vector stores, file search, and knowledge ingestion;
- WhatsApp message and media provider charges;
- retry loops and multi-agent orchestration;
- long legal or tachograph context sent repeatedly;
- persistent storage and retention of documents or media.

Each Premium module needs a cost envelope before implementation:

```text
cost per successful task
cost per active user/month
maximum request cost
retry budget
monthly module cap
degraded-mode behavior when the cap is reached
```

## 10. Risks and controls

| Risk | Financial effect | Control |
|---|---|---|
| No token telemetry | Cost cannot be attributed | Record provider usage metadata |
| Public abuse/automation | Unbounded requests | Authentication, throttling, quotas |
| Very long pasted/OCR text | Higher token cost | Length limits and visible confirmation |
| Retries after timeouts | Duplicate billing | Idempotency strategy and bounded retries |
| Shared keys across environments | Unclear spend source | Separate projects and keys |
| Model price/version change | Forecast becomes stale | Pin model snapshot where appropriate; quarterly review |
| Premium agents call repeatedly | Multiplied task cost | Per-workflow call budget |
| Assuming Business includes API | Wrong procurement decision | Keep workspace and API budgets separate |
| Choosing Batch for live translation | Unacceptable UX | Batch only for asynchronous jobs |
| Premature Scale commitment | Large unused fixed cost | Require measured TPM and contract review |

## Final recommendation

1. Retain `gpt-4.1-mini` Standard Pay-As-You-Go for development and initial launch.
2. Treat OCR, dictation, and playback as zero direct AGM API cost in the current Basic
   implementation.
3. Do not purchase ChatGPT Business/Enterprise seats as a substitute for application
   API consumption.
4. Add cost telemetry and budget controls before public launch; this is the main audit
   gap.
5. Use Batch only for future asynchronous Premium jobs and Priority only when measured
   latency value justifies the premium.
6. Reassess commercial terms at USD 500, USD 2,000, and approximately USD 10,000 in
   monthly API spend, or earlier if an SLA/compliance requirement appears.

Decision status: **Standard PAYG recommended; no billing or model change implemented**.

## Official pricing references

- OpenAI `gpt-4.1-mini` model and Standard token pricing:
  https://developers.openai.com/api/docs/models/gpt-4.1-mini
- OpenAI Batch API completion window and discount:
  https://platform.openai.com/docs/api-reference/batch/object
- OpenAI Priority Processing pricing and service characteristics:
  https://openai.com/api-priority-processing/
- OpenAI Scale Tier pricing, minimum duration, capacity, and SLA:
  https://openai.com/api-scale-tier/
- OpenAI API Enterprise sales guidance:
  https://help.openai.com/en/articles/9047878-how-can-i-contact-sales
- Separation between ChatGPT Business and API billing:
  https://help.openai.com/en/articles/8542115-chatgpt-team-faq
