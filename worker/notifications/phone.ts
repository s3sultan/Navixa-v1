export function normalizeSaudiPhone(value?: string) {
  const raw = (value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+9665\d{8}$/.test(digits)) return digits;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  return "";
}

export function providerPhone(value?: string) {
  return normalizeSaudiPhone(value).replace(/^\+/, "");
}
