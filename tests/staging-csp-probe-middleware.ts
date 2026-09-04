import { NextRequest, NextResponse } from "next/server";

const PROBE_PARAM = "csp_nonce_probe";

function probePolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self'",
    "manifest-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com https://accounts.google.com https://cdn.jsdelivr.net`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://quran.islam-db.com",
    "media-src 'self' blob:",
    "connect-src 'self' https://accounts.google.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    "report-uri /api/security/csp-report",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.nextUrl.searchParams.has(PROBE_PARAM)) return response;

  const nonce = crypto.randomUUID().replaceAll("-", "");
  response.headers.set("Content-Security-Policy-Report-Only", probePolicy(nonce));
  response.headers.set("X-NAVIXA-CSP-Probe", "nonce-v1");
  return response;
}

export const config = {
  matcher: ["/", "/today", "/account", "/admin/login", "/meetings"],
};
