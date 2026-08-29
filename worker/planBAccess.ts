import {
  emergencyEntitlementKey,
  normalizeEmergencyEmail,
  snapshotAllowsEmail,
  type EmergencyEntitlementSnapshot,
} from "./emergencyEntitlements.ts";
import type { EmergencyState } from "./emergencyMode.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PLAN_B_URL = "https://navixa.s2shug.chatgpt.site";
const MAX_GRANT_SECONDS = 15 * 60;

type GrantPayload = {
  v: 1;
  sub: string;
  iat: number;
  exp: number;
  incident: string;
};

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeB64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signingKey(secret: string, usages: KeyUsage[]) {
  if (!secret) throw new Error("missing_plan_b_signing_secret");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

export function planBMayOpen(state: EmergencyState) {
  return state === "outage" || state === "recovery";
}

export async function issuePlanBGrant(input: {
  snapshot: EmergencyEntitlementSnapshot;
  email: string;
  entitlementSecret: string;
  signingSecret: string;
  emergencyState: EmergencyState;
  incidentId: string;
  now?: Date;
  ttlSeconds?: number;
}) {
  const now = input.now ?? new Date();
  if (!planBMayOpen(input.emergencyState)) throw new Error("plan_b_not_open");
  if (!input.incidentId) throw new Error("missing_incident");
  const email = normalizeEmergencyEmail(input.email);
  if (!email) throw new Error("invalid_email");
  if (!(await snapshotAllowsEmail(input.snapshot, email, input.entitlementSecret, now))) throw new Error("plus_required");

  const ttl = Math.max(60, Math.min(MAX_GRANT_SECONDS, Math.floor(input.ttlSeconds ?? 600)));
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: GrantPayload = {
    v: 1,
    sub: await emergencyEntitlementKey(email, input.entitlementSecret),
    iat: issuedAt,
    exp: issuedAt + ttl,
    incident: input.incidentId,
  };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey(input.signingSecret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${b64url(new Uint8Array(signature))}`;
}

export async function verifyPlanBGrant(token: string, signingSecret: string, now = new Date()) {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  try {
    const key = await signingKey(signingSecret, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decodeB64url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(decodeB64url(body))) as GrantPayload;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (payload.v !== 1 || !payload.sub || !payload.incident || payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds) return null;
    if (payload.exp - payload.iat > MAX_GRANT_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}
