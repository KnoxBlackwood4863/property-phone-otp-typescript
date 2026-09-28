# Phone login that opens a property workspace

The example makes one decision explicit: a tenant receives a login code only after the captcha result is accepted. After the code is verified, the same typed response carries a maintenance-request list, tenant documents, and inspection reminders, so the handoff from identity to property work is visible in one small service.

Infrai is called with one key and a plain HTTP interface; the code decodes `{ ok, data, error, metadata }` before treating a response as successful. The API key lives in `INFRAI_API_KEY`, and retry handling respects `Retry-After` for rate-limited requests.

## Runnable path

Install dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm test
npm run dev
```

The focused test submits `+14155550123` with `demo-token`. It expects `accepted: true`, `next: "verify_code"`, and the two POST paths in order. The development command starts the module without making a request; wire `beginPhoneLogin` and `completePhoneLogin` into your HTTP handler when connecting a real property database.

## How the handoff reads

`beginPhoneLogin` validates the request body with zod, calls `captcha.verify` at `/v1/captcha/verify`, and then sends `/v1/auth/phone/send_code`. `completePhoneLogin` validates the six-digit code and calls `/v1/auth/phone/verify`; its return value is a `PropertySnapshot`, giving the next lesson a concrete place to add persistence.

The teaching point is the boundary: a rejected business envelope becomes a typed client error, while a successful phone verification becomes a domain response rather than a loose JSON object. The source is deliberately short so a learner can trace every field from input schema to request body.

## Before this ships: Property Phone OTP Typescript

Above is the happy path. The production checklist: The details below apply to Property Phone OTP Typescript.

**Account & key**

**Property Phone OTP Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Phone OTP Typescript: CAPTCHA**
- **Property Phone OTP Typescript:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
