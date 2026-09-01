"use client";

import { useState } from "react";

export default function InterestForm() {
  const [email, setEmail] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/plus/interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(data.error || "تعذر تسجيل الاهتمام الآن"); return; }
      setNotice(data.message || "تم تسجيل اهتمامك");
      setEmail("");
    } catch {
      setNotice("تعذر الاتصال الآن. تحقق من الإنترنت وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="plus-interest" id="interest"><div><small>التجارب القادمة</small><h2>وصلك الخبر عند إتاحة هِمّة</h2><p>أضف بريدك فقط لتلقي دعوة عند فتح هِمّة. لا يوجد دفع أو طلب بطاقة عبر هذا النموذج.</p></div><form onSubmit={submit}><input value={email} onChange={event => setEmail(event.target.value)} placeholder="بريدك الإلكتروني" type="email" required maxLength={160} autoComplete="email" disabled={busy} /><button disabled={busy}>{busy ? "جارٍ التسجيل…" : "سجّل اهتمامك"}</button>{notice && <p role="status" aria-live="polite">{notice}</p>}</form></section>;
}
