"use client";

import { useState } from "react";

export default function InterestForm() {
  const [email, setEmail] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); const response = await fetch("/api/plus/interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { setNotice(data.error || "تعذر تسجيل الاهتمام الآن"); return; } setNotice(data.message || "تم تسجيل اهتمامك"); setEmail(""); };
  return <section className="plus-interest" id="interest"><div><small>التجارب القادمة</small><h2>وصلك الخبر عند إتاحة Plus</h2><p>أضف بريدك فقط لتلقي دعوة عند فتح التجارب. لا يوجد دفع أو طلب بطاقة عبر هذا النموذج.</p></div><form onSubmit={submit}><input value={email} onChange={event => setEmail(event.target.value)} placeholder="بريدك الإلكتروني" type="email" required maxLength={160} autoComplete="email" /><button disabled={busy}>{busy ? "جارٍ التسجيل…" : "سجّل اهتمامك"}</button>{notice && <p role="status">{notice}</p>}</form></section>;
}
