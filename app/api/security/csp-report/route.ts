import { NextResponse } from "next/server.js";
import { recordCspCompatibilityReport, type SiteHealthDatabase } from "../../../../worker/siteHealth.ts";

const allowedDirectives = new Set(["default-src", "base-uri", "object-src", "frame-ancestors", "form-action", "upgrade-insecure-requests"]);

function blockedHost(value: unknown) {
  if (typeof value !== "string" || !value) return "unknown";
  try { return new URL(value).host || new URL(value).protocol.replace(":", ""); } catch { return value.startsWith("data:") ? "data" : "unknown"; }
}

async function db(): Promise<SiteHealthDatabase | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: SiteHealthDatabase } }).env?.DB || null; } catch { return (globalThis as { DB?: SiteHealthDatabase }).DB || null; } }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { "csp-report"?: Record<string, unknown> };
  const report = body["csp-report"] || {};
  const directive = typeof report["violated-directive"] === "string" ? report["violated-directive"].split(" ")[0] : "unknown";
  const host = blockedHost(report["blocked-uri"]);
  const normalizedDirective = allowedDirectives.has(directive) ? directive : "other";
  const database = await db();
  if (database) await recordCspCompatibilityReport(database, { directive: normalizedDirective, blockedHost: host }).catch(() => undefined);
  // Keep compatibility telemetry aggregate-only: no document URI, query, user, or content is recorded.
  console.log(JSON.stringify({ event: "csp_report_only", directive: normalizedDirective, blocked_host: host }));
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
