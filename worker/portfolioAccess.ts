import { resolveUserSession, type D1Database } from "./userAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type PortfolioDatabase = D1Database & { prepare: (sql: string) => Statement };

export const PORTFOLIO_APPS = {
  fitness: "https://fitness.navixasa.com/api/navixa/complete",
  kids: "https://kids.navixasa.com/api/navixa/complete",
  learning: "https://learning.navixasa.com/api/navixa/complete",
} as const;

export type PortfolioApp = keyof typeof PORTFOLIO_APPS;
export type PortfolioMembership = {
  userId: string;
  plan: string;
  status: "trial" | "active";
  endsAt: string;
};

const encoder = new TextEncoder();

function toBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function portfolioApp(value: string | null): PortfolioApp | null {
  return value && Object.prototype.hasOwnProperty.call(PORTFOLIO_APPS, value) ? value as PortfolioApp : null;
}

export async function resolvePortfolioMembership(request: Request, database: PortfolioDatabase): Promise<PortfolioMembership | null> {
  const session = await resolveUserSession(request, database);
  if (!session) return null;
  const rows = await database.prepare(
    "SELECT plan,status,trial_ends_at,subscription_ends_at FROM navixa_subscribers WHERE (user_id=? OR contact=?) AND status IN ('trial','active') ORDER BY updated_at DESC LIMIT 1",
  ).bind(session.userId, session.email).all<{ plan: string; status: "trial" | "active"; trial_ends_at: string; subscription_ends_at: string }>();
  const subscription = rows.results[0];
  if (!subscription) return null;
  const endsAt = subscription.status === "trial" ? subscription.trial_ends_at : subscription.subscription_ends_at;
  if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.now()) return null;
  return { userId: session.userId, plan: subscription.plan, status: subscription.status, endsAt };
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function signaturesMatch(expected: Uint8Array, received: Uint8Array) {
  let difference = expected.length ^ received.length;
  const length = Math.max(expected.length, received.length);
  for (let index = 0; index < length; index += 1) difference |= (expected[index] || 0) ^ (received[index] || 0);
  return difference === 0;
}

export async function createPortfolioGrant(input: { app: PortfolioApp; membership: PortfolioMembership; secret: string }) {
  const now = Date.now();
  const membershipEndsAt = Date.parse(input.membership.endsAt);
  const expiresAt = Math.min(membershipEndsAt, now + 5 * 60_000);
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    iss: "navixasa.com",
    aud: input.app,
    sub: input.membership.userId,
    plan: input.membership.plan,
    membership: input.membership.status,
    membershipEndsAt: input.membership.endsAt,
    iat: Math.floor(now / 1000),
    exp: Math.floor(expiresAt / 1000),
    jti: crypto.randomUUID(),
  })));
  const signature = toBase64Url(await sign(`${header}.${payload}`, input.secret));
  return `${header}.${payload}.${signature}`;
}

export async function verifyPortfolioGrant(token: string, app: PortfolioApp, secret: string) {
  const [header, payload, signature, ...rest] = token.split(".");
  if (!header || !payload || !signature || rest.length) return null;
  const expected = await sign(`${header}.${payload}`, secret);
  const received = fromBase64Url(signature);
  if (!signaturesMatch(expected, received)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      iss?: unknown; aud?: unknown; sub?: unknown; plan?: unknown; membership?: unknown; membershipEndsAt?: unknown; exp?: unknown;
    };
    if (data.iss !== "navixasa.com" || data.aud !== app || typeof data.sub !== "string" || typeof data.plan !== "string") return null;
    if (data.membership !== "trial" && data.membership !== "active") return null;
    if (typeof data.membershipEndsAt !== "string" || Date.parse(data.membershipEndsAt) <= Date.now()) return null;
    if (typeof data.exp !== "number" || data.exp * 1000 <= Date.now()) return null;
    return { userId: data.sub, plan: data.plan, membership: data.membership, membershipEndsAt: data.membershipEndsAt };
  } catch { return null; }
}
