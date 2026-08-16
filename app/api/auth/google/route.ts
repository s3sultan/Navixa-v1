import { NextResponse } from "next/server";
import { verifyAdminGoogleCredential } from "../googleIdentity";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const credential = typeof body.credential === "string" ? body.credential : "";
  const verified = await verifyAdminGoogleCredential(credential);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, {
      status: verified.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json({ ok: true, credential }, { headers: { "Cache-Control": "no-store" } });
}
