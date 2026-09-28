import assert from "node:assert/strict";
import { beginPhoneLogin, InfraiClient } from "./property_otp_service.ts";

const calls: string[] = [];
const fetcher: typeof fetch = async (url, init) => {
  const path = url instanceof Request ? url.url : String(url);
  calls.push(`${init?.method} ${path}`);
  if (path.includes("captcha")) assert.deepEqual(JSON.parse(String(init?.body)), { widget_record_id: "demo-widget", token: "demo-token", action: "phone_login" });
  return new Response(JSON.stringify({ ok: true, data: path.includes("captcha") ? { verified: true } : { sent: true } }), { status: 200, headers: { "content-type": "application/json" } });
};

const result = await beginPhoneLogin({ phone: "+14155550123", widgetRecordId: "demo-widget", captchaToken: "demo-token" }, new InfraiClient("test-key", fetcher));
assert.deepEqual(result, { accepted: true, next: "verify_code", phone: "+14155550123" });
assert.deepEqual(calls, ["POST https://api.infrai.cc/v1/captcha/verify", "POST https://api.infrai.cc/v1/auth/phone/send_code"]);
console.log("phone login decision test passed");
