import type {
  BillingIntentForProvider,
  PaymentProviderAdapter,
  ProviderEnvironment,
  ProviderPayment,
  ProviderReadiness,
} from "./types.ts";

const endpoint = "https://secure.telr.com/gateway/order.json";
const testSecrets = ["TELR_STORE_ID", "TELR_TEST_AUTH_KEY", "TELR_WEBHOOK_SECRET"];
const liveSecrets = ["TELR_STORE_ID", "TELR_LIVE_AUTH_KEY", "TELR_WEBHOOK_SECRET"];

type TelrEnvironment = ProviderEnvironment & {
  NAVIXA_TELR_ENABLED?: string;
  NAVIXA_TELR_MODE?: string;
};

type TelrOrder = {
  ref?: unknown;
  url?: unknown;
  cartid?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: { code?: unknown; text?: unknown };
  transaction?: { ref?: unknown; status?: unknown };
};

type TelrResponse = { order?: TelrOrder; error?: { message?: unknown; note?: unknown } };

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function telrMode(environment: TelrEnvironment) {
  return environment.NAVIXA_TELR_MODE === "live" ? "live" as const : "sandbox" as const;
}

function amountInMajorSar(amount: number) {
  return (amount / 100).toFixed(2);
}

function requiredSecrets(environment: TelrEnvironment) {
  return (telrMode(environment) === "live" ? liveSecrets : testSecrets).filter((name) => !environment[name]);
}

function authKey(environment: TelrEnvironment) {
  return telrMode(environment) === "live" ? environment.TELR_LIVE_AUTH_KEY || "" : environment.TELR_TEST_AUTH_KEY || "";
}

export const telrAdapter: PaymentProviderAdapter = {
  id: "telr",
  supportedMethods: ["mada", "visa", "mastercard", "applepay", "stcpay", "tabby"],
  readiness(environment: ProviderEnvironment): ProviderReadiness {
    const telrEnvironment = environment as TelrEnvironment;
    const missingSecrets = requiredSecrets(telrEnvironment);
    const enabledByAdmin = telrEnvironment.NAVIXA_TELR_ENABLED === "true";
    const mode = telrMode(telrEnvironment);
    return {
      provider: "telr",
      enabled: enabledByAdmin && missingSecrets.length === 0,
      mode: enabledByAdmin && missingSecrets.length === 0 ? mode : "disabled",
      missingSecrets,
      supportedMethods: this.supportedMethods,
    };
  },
};

export function buildTelrHostedPaymentRequest(input: {
  intent: BillingIntentForProvider;
  environment: TelrEnvironment;
  authorisedUrl: string;
  declinedUrl: string;
  cancelledUrl: string;
  webhookUrl: string;
  panels: string[];
}) {
  const missingSecrets = requiredSecrets(input.environment);
  if (input.environment.NAVIXA_TELR_ENABLED !== "true" || missingSecrets.length) {
    return { ok: false as const, error: "Telr غير مفعّل أو مفاتيح البيئة المختارة غير مكتملة" };
  }
  const store = Number(input.environment.TELR_STORE_ID || "");
  const key = authKey(input.environment);
  if (!Number.isInteger(store) || store <= 0 || !key) return { ok: false as const, error: "بيانات Telr غير صالحة" };
  return {
    ok: true as const,
    request: {
      method: "create",
      store,
      authkey: key,
      order: {
        cartid: input.intent.id.slice(0, 63),
        test: telrMode(input.environment) === "live" ? "0" : "1",
        amount: amountInMajorSar(input.intent.amount),
        currency: input.intent.currency,
        description: input.intent.description.slice(0, 63),
      },
      return: { authorised: input.authorisedUrl, declined: input.declinedUrl, cancelled: input.cancelledUrl },
      panels: input.panels.filter(Boolean).join(","),
      webhooks: [{ url: input.webhookUrl }],
    },
  };
}

export async function createTelrHostedCheckout(input: Parameters<typeof buildTelrHostedPaymentRequest>[0]) {
  const built = buildTelrHostedPaymentRequest(input);
  if (!built.ok) return { ok: false as const, error: built.error };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(built.request) });
  const body = await response.json().catch(() => ({})) as TelrResponse;
  const url = clean(body.order?.url, 500);
  const reference = clean(body.order?.ref, 180);
  if (!response.ok || !url.startsWith("https://secure.telr.com/gateway/") || !reference) return { ok: false as const, error: "تعذر إنشاء جلسة Telr" };
  return { ok: true as const, redirectUrl: url, reference };
}

export async function verifyTelrPayment(input: {
  environment: TelrEnvironment;
  providerReference: string;
  expectedIntentId: string;
  expectedAmount: number;
  expectedCurrency: "SAR";
}): Promise<ProviderPayment | null> {
  const missingSecrets = requiredSecrets(input.environment);
  const store = Number(input.environment.TELR_STORE_ID || "");
  const key = authKey(input.environment);
  if (missingSecrets.length || !Number.isInteger(store) || store <= 0 || !key || !input.providerReference) return null;
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ method: "check", store, authkey: key, order: { ref: input.providerReference } }) });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({})) as TelrResponse;
  const order = body.order || {};
  const cartId = clean(order.cartid, 100);
  const amount = clean(order.amount, 32);
  const currency = clean(order.currency, 12);
  const transactionReference = clean(order.transaction?.ref || order.ref, 180);
  const authorised = clean(order.transaction?.status, 12) === "A";
  if (!authorised || cartId !== input.expectedIntentId || amount !== amountInMajorSar(input.expectedAmount) || currency !== input.expectedCurrency || !transactionReference) return null;
  return { provider: "telr", paymentId: transactionReference, status: "paid", amount: input.expectedAmount, currency, intentId: cartId };
}

export const telrActivationRule = "يبقى Telr مخفيًا عن الزوار حتى يعتمد حساب التاجر، وتُضاف مفاتيح Sandbox، وينجح تحقق الحالة وWebhook الموقّع، ثم يمر اختبار حي محدود بتأكيد صريح.";
