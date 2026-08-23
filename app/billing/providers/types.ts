export type PaymentProviderId = "moyasar" | "tamara" | "tabby" | "tap" | "telr" | "paytabs" | "myfatoorah";

export type PaymentMethodId =
  | "mada"
  | "visa"
  | "mastercard"
  | "applepay"
  | "stcpay"
  | "samsungpay"
  | "tamara"
  | "tabby";

export type BillingIntentForProvider = {
  id: string;
  amount: number;
  currency: "SAR";
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
};

export type ProviderCheckout = {
  provider: PaymentProviderId;
  amount: number;
  currency: "SAR";
  callbackUrl: string;
  methods: string[];
  publicKey?: string;
  metadata: Record<string, string>;
  applePay?: { country: "SA"; label: string; validateMerchantUrl: string } | null;
  state: "ready" | "disabled";
  disabledReason?: string;
};

export type ProviderPayment = {
  provider: PaymentProviderId;
  paymentId: string;
  status: "paid" | "pending" | "failed" | "unknown";
  amount: number;
  currency: string;
  intentId: string;
};

export type NormalizedWebhookEvent = {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  paymentId: string;
  intentId: string;
  paid: boolean;
  amount?: number;
  currency?: string;
  raw: Record<string, unknown>;
};

export type ProviderReadiness = {
  provider: PaymentProviderId;
  enabled: boolean;
  mode: "disabled" | "sandbox" | "live";
  missingSecrets: string[];
  supportedMethods: PaymentMethodId[];
};

export type ProviderEnvironment = Record<string, string | undefined>;

export interface PaymentProviderAdapter {
  id: PaymentProviderId;
  supportedMethods: PaymentMethodId[];
  readiness(environment: ProviderEnvironment): ProviderReadiness;
}
