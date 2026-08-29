import { resolveUserSession, type D1Database } from "./userAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type PortfolioDatabase = D1Database & { prepare: (sql: string) => Statement };

export const PORTFOLIO_APPS = {
  fitness: "https://fitness.navixasa.com/api/navixa/complete",
  kids: "https://kids.navixasa.com/api/navixa/complete",
  learning: "https://learning.navixasa.com/api/navixa/complete",
} as const;

export const PORTFOLIO_APP_HOMES = {
  fitness: "https://fitness.navixasa.com/",
  kids: "https://kids.navixasa.com/",
  learning: "https://learning.navixasa.com/",
} as const;

export const PORTFOLIO_SSO_ENABLED = {
  fitness: true,
  kids: true,
  learning: true,
} as const;

export const PORTFOLIO_PUBLIC_JWK: JsonWebKey = { key_ops: ["verify"], ext: true, kty: "EC", x: "3t4IG1-SSwzOL6me14lxVhh4a2Oab6-xxgLURaqtHNU", y: "Fm3gm4pXJlkhso9ITBTW6B9U1SuVy5V0EKabg9KL9wk", crv: "P-256" };
export type PortfolioApp = keyof typeof PORTFOLIO_APPS;
export type PortfolioMembership = { userId: string; plan: string; status: "active"; endsAt: string };

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

function privateJwk(value: string): JsonWebKey | null {
  try {
    const parsed = JSON.parse(value) as JsonWebKey;
    return parsed.kty === "EC" && parsed.crv === "P-256" && typeof parsed.d === "string" ? parsed : null;
  } catch { return null; }
}

export function portfolioJwksFromPrivateKey(value: string) {
  const privateKey = privateJwk(value);
  if (!privateKey || typeof privateKey.x !== "string" || typeof privateKey.y !== "string") return null;
  return {
    keys: [{
      key_ops: ["verify"], ext: true, kty: "EC", x: privateKey.x, y: privateKey.y, crv: "P-256",
      kid: "navixa-portfolio-es256-v1", use: "sig", alg: "ES256",
    }],
  } as const;
}

async function signingKey(value: string) {
  const jwk = privateJwk(value);
  if (!jwk) return null;
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export function portfolioApp(value: string | null): PortfolioApp | null {
  return value && Object.prototype.hasOwnProperty.call(PORTFOLIO_APPS, value) ? value as PortfolioApp : null;
}

export async function resolvePortfolioMembership(request: Request, database: PortfolioDatabase): Promise<PortfolioMembership | null> {
  const session = await resolveUserSession(request, database);
  if (!session) return null;
  const rows = await database.prepare(
    "SELECT plan,status,subscription_ends_at FROM navixa_subscribers WHERE (user_id=? OR contact=?) AND status='active' ORDER BY updated_at DESC LIMIT 1",
  ).bind(session.userId, session.email).all<{ plan: string; status: "active"; subscription_ends_at: string }>();
  const subscription = rows.results[0];
  if (!subscription) return null;
  const plan = String(subscription.plan || "").trim().toLowerCase();
  if (plan !== "plus") return null;
  const endsAt = subscription.subscription_ends_at;
  if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.now()) return null;
  return { userId: session.userId, plan: subscription.plan, status: "active", endsAt };
}

export async function createPortfolioGrant(input: { app: PortfolioApp; membership: PortfolioMembership; privateKeyJwk: string }) {
  const key = await signingKey(input.privateKeyJwk);
  if (!key) throw new Error("NAVIXA portfolio signing key is unavailable");
  const now = Date.now();
  const membershipEndsAt = Date.parse(input.membership.endsAt);
  const expiresAt = Math.min(membershipEndsAt, now + 5 * 60_000);
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    iss: "navixasa.com", aud: input.app, sub: input.membership.userId, plan: input.membership.plan,
    membership: input.membership.status, membershipEndsAt: input.membership.endsAt, iat: Math.floor(now / 1000),
    exp: Math.floor(expiresAt / 1000), jti: crypto.randomUUID(),
  })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${toBase64Url(signature)}`;
}

export async function verifyPortfolioGrant(token: string, app: PortfolioApp, publicJwk: JsonWebKey = PORTFOLIO_PUBLIC_JWK) {
  const [header, payload, signature, ...rest] = token.split(".");
  if (!header || !payload || !signature || rest.length) return null;
  try {
    const parsedHeader = JSON.parse(new TextDecoder().decode(fromBase64Url(header))) as { alg?: unknown; typ?: unknown };
    if (parsedHeader.alg !== "ES256" || parsedHeader.typ !== "JWT") return null;
    const key = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), encoder.encode(`${header}.${payload}`));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { iss?: unknown; aud?: unknown; sub?: unknown; plan?: unknown; membership?: unknown; membershipEndsAt?: unknown; exp?: unknown };
    if (data.iss !== "navixasa.com" || data.aud !== app || typeof data.sub !== "string" || typeof data.plan !== "string") return null;
    if (data.membership !== "active" || String(data.plan).trim().toLowerCase() !== "plus") return null;
    if (typeof data.membershipEndsAt !== "string" || Date.parse(data.membershipEndsAt) <= Date.now()) return null;
    if (typeof data.exp !== "number" || data.exp * 1000 <= Date.now()) return null;
    return { userId: data.sub, plan: data.plan, membership: data.membership, membershipEndsAt: data.membershipEndsAt };
  } catch { return null; }
}
