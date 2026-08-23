import { moyasarAdapter } from "./moyasar.ts";
import { tamaraAdapter } from "./tamara.ts";
import type { PaymentProviderAdapter, PaymentProviderId, ProviderEnvironment, ProviderReadiness } from "./types.ts";

export * from "./types.ts";
export { buildMoyasarCheckout, moyasarAdapter, normalizeMoyasarWebhook, verifyMoyasarPayment } from "./moyasar.ts";
export { tamaraActivationRule, tamaraAdapter } from "./tamara.ts";

const adapters: Partial<Record<PaymentProviderId, PaymentProviderAdapter>> = {
  moyasar: moyasarAdapter,
  tamara: tamaraAdapter,
};

export function providerAdapter(id: PaymentProviderId) {
  return adapters[id] || null;
}

export function providerReadiness(environment: ProviderEnvironment): ProviderReadiness[] {
  return Object.values(adapters).filter(Boolean).map((adapter) => adapter!.readiness(environment));
}

export const paymentProviderRolloutOrder: PaymentProviderId[] = [
  "moyasar",
  "tamara",
  "tabby",
  "tap",
  "telr",
  "paytabs",
  "myfatoorah",
];
