import type { PaymentProviderAdapter, ProviderEnvironment, ProviderReadiness } from "./types.ts";

const requiredTestSecrets = [
  "TAMARA_API_URL",
  "TAMARA_TEST_API_TOKEN",
  "TAMARA_WEBHOOK_SECRET",
];

const requiredLiveSecrets = [
  "TAMARA_API_URL",
  "TAMARA_LIVE_API_TOKEN",
  "TAMARA_WEBHOOK_SECRET",
];

export const tamaraAdapter: PaymentProviderAdapter = {
  id: "tamara",
  supportedMethods: ["tamara"],
  readiness(environment: ProviderEnvironment): ProviderReadiness {
    const requestedMode = environment.NAVIXA_TAMARA_MODE === "live" ? "live" : "sandbox";
    const enabledByAdmin = environment.NAVIXA_TAMARA_ENABLED === "true";
    const required = requestedMode === "live" ? requiredLiveSecrets : requiredTestSecrets;
    const missingSecrets = required.filter((name) => !environment[name]);
    return {
      provider: "tamara",
      enabled: enabledByAdmin && missingSecrets.length === 0,
      mode: enabledByAdmin && missingSecrets.length === 0 ? requestedMode : "disabled",
      missingSecrets,
      supportedMethods: this.supportedMethods,
    };
  },
};

export const tamaraActivationRule = "Tamara يبقى مخفيًا حتى يعتمد التاجر ويرسل مفاتيح Sandbox وتنجح اختبارات الجلسة والـWebhook والتحقق الخادمي.";
