export type PremiumMessageEvent = "name_heard" | "screen_watch" | "security" | "billing" | "otp";

export type MessagingPolicy = {
  publicVisible: boolean;
  enabled: boolean;
  monthlyQuota: number;
  cooldownSeconds: number;
  allowedEvents: PremiumMessageEvent[];
};

// Hidden foundation only. Public purchase controls stay disabled until launch.
export const DEFAULT_MESSAGING_POLICY: MessagingPolicy = {
  publicVisible: false,
  enabled: false,
  monthlyQuota: 0,
  cooldownSeconds: 300,
  allowedEvents: ["name_heard", "screen_watch", "security", "billing", "otp"],
};

export function messagingPolicyFromValues(values: Partial<Record<keyof MessagingPolicy, unknown>>): MessagingPolicy {
  const quota = Number(values.monthlyQuota);
  const cooldown = Number(values.cooldownSeconds);
  return {
    publicVisible: values.publicVisible === true,
    enabled: values.enabled === true,
    monthlyQuota: Number.isFinite(quota) ? Math.max(0, Math.floor(quota)) : DEFAULT_MESSAGING_POLICY.monthlyQuota,
    cooldownSeconds: Number.isFinite(cooldown) ? Math.max(60, Math.floor(cooldown)) : DEFAULT_MESSAGING_POLICY.cooldownSeconds,
    allowedEvents: Array.isArray(values.allowedEvents)
      ? values.allowedEvents.filter((value): value is PremiumMessageEvent => DEFAULT_MESSAGING_POLICY.allowedEvents.includes(value as PremiumMessageEvent))
      : DEFAULT_MESSAGING_POLICY.allowedEvents,
  };
}

export function canExposeMessagingAddon(policy: MessagingPolicy) {
  return policy.publicVisible && policy.enabled;
}
