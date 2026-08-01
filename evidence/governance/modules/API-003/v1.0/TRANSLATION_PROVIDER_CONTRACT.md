# API-003 — Contract Translation Provider v1

**Contract:** `translation-provider.v1`  
**Provider:** OpenAI Responses API  
**Model implicit:** `gpt-4.1-mini`

## Reguli

- aceeași limbă returnează textul fără apel extern;
- traducerea între limbi folosește temperatură 0 și instrucțiune strictă fără explicații;
- nume, date, adrese, VIN, numere de înmatriculare, numere și linii trebuie păstrate semantic;
- timeout implicit 20 secunde, limitat între 5 și 60 secunde;
- succesul cere text tradus nenul;
- orice lipsă secret, HTTP failure, timeout, eroare sau output gol produce `available:false`, fără inventarea traducerii;
- health funcțional verifică traducerea efectivă și cache-uiește rezultatul 60 secunde.

## Privacy și observabilitate

Logurile pot conține tipul/codul erorii și durata, dar nu textul sursă, cheia, tokenul sau mesajul brut al providerului.

## NO-GO

- traducere declarată disponibilă fără output valid;
- expunerea textului ori secretelor în loguri;
- timeout nelimitat;
- ocolirea limitelor de limbă/lungime sau throttling;
- schimbarea providerului/modelului Production fără mandat;
- telemetrie continuă OPS-005 fără aprobare.

