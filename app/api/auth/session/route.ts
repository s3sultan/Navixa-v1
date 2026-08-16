import { NextResponse } from "next/server";
import { verifyAdminGoogleCredential } from "../googleIdentity";

function readCredential(request: Request) {
  return request.headers.get("x-navixa-google-credential") || "";
}

export async function GET(request: Request) {
  const credential = readCredential(request);
  const verified = await verifyAdminGoogleCredential(credential);

  if (!verified.ok) {
    return NextResponse.json({ authenticated: false, error: verified.error }, {
      status: verified.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json({ authenticated: true, email: verified.email }, { headers: { "Cache-Control": "no-store" } });
}
