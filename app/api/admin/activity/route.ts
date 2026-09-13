import { NextResponse } from "next/server.js";
import { requireAdminPermission, adminPermissionCatalog } from "../../../../worker/adminAccess.ts";
import { readAdminActivity, type AdminActivityDatabase } from "../../../../worker/adminActivity.ts";

async function db(): Promise<AdminActivityDatabase | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: AdminActivityDatabase } }).env?.DB || null; }
  catch { return (globalThis as { DB?: AdminActivityDatabase }).DB || null; }
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const identity = await requireAdminPermission(request, "activity.read");
  if (!identity) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 50);
  try {
    const items = await readAdminActivity(database, requestedLimit);
    return noStore({
      identity: { email: identity.email, role: identity.role },
      permissions: adminPermissionCatalog,
      items,
    });
  } catch {
    return noStore({ error: "تعذر قراءة سجل النشاط" }, 503);
  }
}
