export type SallaEntitlementRecord = {
  status: string;
  endsAt: string;
};

export type SallaReturnStatus =
  | { state: "pending" }
  | { state: "active"; endsAt: string }
  | { state: "not_activated" };

export function safeSallaCheckoutIntent(value: string | null) {
  return value && /^[a-zA-Z0-9_-]{16,128}$/.test(value) ? value : null;
}

/**
 * يعرض للمتصفح أقل معلومة لازمة. لا يعيد البريد أو رقم طلب سلة أو تفاصيل المزود.
 * لا يمكن أن تنشئ هذه الدالة استحقاقًا؛ حالة active لا تأتي إلا من سجل التسوية الداخلي.
 */
export function toSallaReturnStatus(record: SallaEntitlementRecord | null, now = Date.now()): SallaReturnStatus {
  if (!record) return { state: "pending" };
  if (record.status !== "active") return { state: "not_activated" };
  const endsAt = Date.parse(record.endsAt);
  if (!Number.isFinite(endsAt) || endsAt <= now) return { state: "not_activated" };
  return { state: "active", endsAt: new Date(endsAt).toISOString() };
}
