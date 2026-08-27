export const SALLA_MANUAL_PRODUCT_ID = "41013139";
export const SALLA_MANUAL_PLAN_CODE = "plus_monthly";
export const SALLA_MANUAL_AMOUNT_MINOR = 1900;
export const SALLA_MANUAL_CURRENCY = "SAR";
export const SALLA_PRODUCT_URL = "https://salla.sa/navixa/%D8%A7%D8%B4%D8%AA%D8%B1%D8%A7%D9%83-navixa-plus-%D8%B9%D8%B1%D8%B6-%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D9%8A%D9%86/p41013139";
export const SALLA_MANUAL_REVIEW_DAYS = 30;

export type ManualReviewStatus = "pending" | "processing" | "approved" | "rejected";

export function createSallaManualIntentId() {
  return `salla_manual_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function isSallaManualOrderId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value.trim());
}

export function normalizeSallaManualOrderId(value: string) {
  return value.trim();
}

export function canApproveManualReview(status: string) {
  return status === "pending";
}
