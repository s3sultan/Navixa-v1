import { NextResponse } from "next/server.js";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "تم إيقاف مسار سلة مؤقتًا. التفعيل متاح من لوحة الإدارة فقط إلى أن تُعتمد بوابة دفع رسمية.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST() {
  return disabledResponse();
}
