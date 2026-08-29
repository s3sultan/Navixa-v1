type Statement = {
  bind: (...values: unknown[]) => Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};

export type EmergencyEntitlementDatabase = { prepare: (sql: string) => Statement };

export type EmergencyEntitlementRecord = {
  entitlementKey: string;
  activeUntil: string;
};

export type EmergencyEntitlementSnapshot = {
  generatedAt: string;
  version: 1;
  records: EmergencyEntitlementRecord[];
};

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function normalizeEmergencyEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function emergencyEntitlementKey(email: string, secret: string) {
  const normalized = normalizeEmergencyEmail(email);
  if (!normalized || !secret) throw new Error("missing_entitlement_secret");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return base64Url(new Uint8Array(signature));
}

/**
 * Build the minimum dataset Plan B needs to answer one question:
 * "Does this normalized NAVIXA email have an active paid Plus entitlement?"
 *
 * No display name, user id, Telegram id, payment details, session tokens, OTP data,
 * or raw email addresses are included in the snapshot.
 */
export async function buildEmergencyEntitlementSnapshot(
  db: EmergencyEntitlementDatabase,
  secret: string,
  now = new Date(),
): Promise<EmergencyEntitlementSnapshot> {
  if (!secret) throw new Error("missing_entitlement_secret");
  const nowIso = now.toISOString();
  const rows = await db.prepare(
    "SELECT contact,subscription_ends_at FROM navixa_subscribers WHERE status='active' AND contact<>'' AND subscription_ends_at>? ORDER BY contact ASC",
  ).bind(nowIso).all<{ contact: string; subscription_ends_at: string }>();

  const records: EmergencyEntitlementRecord[] = [];
  for (const row of rows.results) {
    const normalized = normalizeEmergencyEmail(row.contact);
    if (!normalized || !row.subscription_ends_at) continue;
    records.push({
      entitlementKey: await emergencyEntitlementKey(normalized, secret),
      activeUntil: row.subscription_ends_at,
    });
  }

  return {
    generatedAt: nowIso,
    version: 1,
    records,
  };
}

export async function snapshotAllowsEmail(
  snapshot: EmergencyEntitlementSnapshot,
  email: string,
  secret: string,
  now = new Date(),
) {
  const key = await emergencyEntitlementKey(email, secret);
  const nowMs = now.getTime();
  return snapshot.records.some(record => record.entitlementKey === key && Date.parse(record.activeUntil) > nowMs);
}
