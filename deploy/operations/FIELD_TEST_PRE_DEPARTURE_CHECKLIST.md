# Field Test — pre-departure checklist

Complete with the vehicle parked. Target time: five minutes.

## Automatic gate

- [ ] `FIELD_TEST_READY` returned by `Invoke-AGMFieldTest.ps1 -Action Prepare`.
- [ ] Premium provider registry active.
- [ ] Gmail intake `HEALTHY`.
- [ ] TomTom `LIVE / HEALTHY`.
- [ ] HERE route/intermodal `HEALTHY`.
- [ ] TollGuru trial `ACTIVE / HEALTHY`.
- [ ] Guardian configured; `secretDisplayed=false`.
- [ ] Provider/OI/Copilot telemetry active.
- [ ] Cache/freshness and manual fallback evidence present.
- [ ] Web/Android build `1.3.0`; Android `versionCode 21`.

## Operator gate

- [ ] AGM Premium login succeeds.
- [ ] Car Mover and Planning open.
- [ ] Mobile-data connection available or degraded mode acknowledged.
- [ ] Android battery/power and location permissions ready.
- [ ] Start timestamp and device recorded.
- [ ] Driver will not operate the app while moving.
- [ ] Passenger/tester identified, if applicable.
- [ ] Observation JSON copied and ready.
- [ ] No authority/fencing error visible.
- [ ] Manual fallback remains accessible.

Start only after all safety items pass. Provider degradation may be accepted when the intended fallback is operational.

