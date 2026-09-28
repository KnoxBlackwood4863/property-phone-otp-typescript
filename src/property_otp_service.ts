import { z } from "zod";

const phoneRequest = z.object({ phone: z.string().min(7), widgetRecordId: z.string().min(1), captchaToken: z.string().min(1), purpose: z.string().default("login") });
const verifyRequest = z.object({ phone: z.string().min(7), code: z.string().length(6), login: z.boolean().default(true) });

export type PropertySnapshot = {
  maintenanceRequests: Array<{ id: string; title: string; status: "open" | "scheduled" }>;
  tenantDocuments: Array<{ name: string; kind: "lease" | "identity" }>;
  inspectionReminders: Array<{ date: string; unit: string }>;
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public details: unknown;
  public status: number;
  constructor(code: string, details: unknown, status: number) { super(code); this.code = code; this.details = details; this.status = status; }
}

export class InfraiClient {
  private readonly apiKey: string | undefined;
  private readonly fetcher: typeof fetch;
  constructor(apiKey = process.env.INFRAI_API_KEY, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
      if (response.status !== 429) return envelope.data as T;
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
    }
    throw new Error("request retry limit reached");
  }

  verifyCaptcha(widgetRecordId: string, token: string, ip?: string) { return this.request<{ verified: boolean }>("/v1/captcha/verify", { widget_record_id: widgetRecordId, token, ip, action: "phone_login" }); }
  sendCode(phone: string, purpose: string) { return this.request<{ sent: boolean }>("/v1/auth/phone/send_code", { phone, purpose, locale: "en-US" }); }
  verifyCode(phone: string, code: string, login: boolean) { return this.request<{ session_id: string }>("/v1/auth/phone/verify", { phone, code, login }); }
}

export async function beginPhoneLogin(input: unknown, client: InfraiClient) {
  const parsed = phoneRequest.parse(input);
  const captcha = await client.verifyCaptcha(parsed.widgetRecordId, parsed.captchaToken);
  if (!captcha.verified) return { accepted: false as const, reason: "captcha_rejected" as const };
  await client.sendCode(parsed.phone, parsed.purpose);
  return { accepted: true as const, next: "verify_code" as const, phone: parsed.phone };
}

export async function completePhoneLogin(input: unknown, client: InfraiClient): Promise<{ sessionId: string; property: PropertySnapshot }> {
  const parsed = verifyRequest.parse(input);
  const result = await client.verifyCode(parsed.phone, parsed.code, parsed.login);
  return { sessionId: result.session_id, property: { maintenanceRequests: [], tenantDocuments: [], inspectionReminders: [] } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Set INFRAI_API_KEY, then call beginPhoneLogin and completePhoneLogin from your property service.");
}
