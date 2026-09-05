export type PublicPlanId = "monthly" | "sprint";

export const PLAN_PRICE_KEYS = {
  monthly: "monthly_price_halalas",
  sprint: "sprint_price_halalas",
} as const;

export const DEFAULT_PLAN_PRICES = {
  monthly: 2900,
  sprint: 1100,
} as const;

export const PUBLIC_PLAN_META = {
  monthly: { id: "monthly" as const, name: "هِمّة", days: 30, periodLabel: "شهر واحد" },
  sprint: { id: "sprint" as const, name: "عَزْم", days: 5, periodLabel: "خمسة أيام" },
} as const;

export function normalizeHalalas(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 100000) return fallback;
  return parsed;
}

export function priceRiyals(halalas: number): string {
  return (halalas / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}
