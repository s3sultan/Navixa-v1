import type {
  BillingIntentForProvider,
  NormalizedWebhookEvent,
  PaymentMethodId,
  PaymentProviderAdapter,
  ProviderCheckout,
  ProviderEnvironment,
  ProviderPayment,
  ProviderReadiness,
} from "./types.ts";

const moyasarMethodMap: Record<PaymentMethodId, string> = {
  mada: "creditcard",
  visa: "creditcard",
  mastercard: "creditcard",
  applepay: "applepay",
  stcpay: "stcpay",
  samsungpay: "samsungpay",
  tamara: "",
  tabby: "",
};

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function paymentId(value: unknown) {
  return clean(value, 160).replace(/[^a-zA-Z0-9_-]/g, "");
}

export const moyasarAdapter: PaymentProviderAdapter = {
  id: "moyasar",
  supportedMethods: ["mada", "visa", "mastercard", "applepay", "stcpay", "samsungpay"],
  readiness(environment: ProviderEnvironment): ProviderReadiness {
    const missingSecrets = [
      "MOYASAR_LIVE_PUBLISHABLE_KEY",
      "MOYASAR_LIVE_SECRET_KEY",
      "MOYASAR_LIVE_WEBHOOK_SECRET",
    ].filter((name) => !environment[name]);
    return {
      provider: "moyasar",
      enabled: missingSecrets.length === 0,
      mode: missingSecrets.length ? "disabled" : "live",
      missingSecrets,
      supportedMethods: this.supportedMethods,
    };
  },
};

export function buildMoyasarCheckout(
  intent: BillingIntentForProvider,
  publicKey: string,
  enabledMethods: PaymentMethodId[],
): ProviderCheckout {
  const methods = [...new Set(enabledMethods.map((method) => moyasarMethodMap[method]).filter(Boolean))] as PaymentMethodId[];
  return {
    provider: "moyasar",
    amount: intent.amount,
    currency: intent.currency,
    callbackUrl: intent.callbackUrl,
    methods,
    publicKey,
    metadata: intent.metadata,
    applePay: enabledMethods.includes("applepay")
      ? { country: "SA", label: "NAVIXA Plus", validateMerchantUrl: "https://api.moyasar.com/v1/applepay/initiate" }
      : null,
    state: methods.length && publicKey ? "ready" : "disabled",
    disabledReason: methods.length && publicKey ? undefined : "مفاتيح مُيسر أو وسائل الدفع غير مكتملة",
  };
}

export async function verifyMoyasarPayment(input: {
  secret: string;
  paymentId: string;
  expectedIntentId: string;
  expectedAmount: number;
  expectedCurrency: string;
}): Promise<ProviderPayment | null> {
  if (!input.secret || !input.paymentId) return null;
  const authorization = `Basic ${btoa(`${input.secret}:`)}`;
  const response = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(input.paymentId)}`, {
    headers: { Authorization: authorization, Accept: "application/json" },
  });
  if (!response.ok) return null;
  const payment = await response.json() as { status?: unknown; amount?: unknown; currency?: unknown; metadata?: unknown; id?: unknown };
  const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata as Record<string, unknown> : {};
  const status = payment.status === "paid" ? "paid" : payment.status === "failed" ? "failed" : payment.status === "initiated" ? "pending" : "unknown";
  const id = paymentId(payment.id || input.paymentId);
  const intentId = clean(metadata.navixa_intent, 100);
  if (!id || intentId !== input.expectedIntentId || payment.amount !== input.expectedAmount || payment.currency !== input.expectedCurrency) return null;
  return { provider: "moyasar", paymentId: id, status, amount: input.expectedAmount, currency: input.expectedCurrency, intentId };
}

export function normalizeMoyasarWebhook(input: {
  body: Record<string, unknown>;
  expectedSecret: string;
}): NormalizedWebhookEvent | null {
  const receivedSecret = clean(input.body.secret_token, 180);
  if (!input.expectedSecret || receivedSecret !== input.expectedSecret) return null;
  const data = input.body.data && typeof input.body.data === "object" ? input.body.data as Record<string, unknown> : {};
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {};
  const eventType = clean(input.body.type || input.body.eventType, 40);
  const eventId = clean(input.body.id || input.body.eventId, 120);
  const intentId = clean(metadata.navixa_intent, 100);
  const id = paymentId(data.id || input.body.payment_id || eventId);
  if (!eventId || !intentId || !id) return null;
  return {
    provider: "moyasar",
    eventId,
    eventType,
    paymentId: id,
    intentId,
    paid: eventType === "payment_paid" || eventType === "subscription_renewed",
    amount: typeof data.amount === "number" ? data.amount : undefined,
    currency: clean(data.currency, 12) || undefined,
    raw: input.body,
  };
}
