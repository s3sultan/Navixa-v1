"use client";

import { useEffect, useState } from "react";

type ManualState = { linked?: boolean; botUsername?: string; error?: string };

export default function TelegramManualLink() {
  const [signedIn, setSignedIn] = useState(false);
  const [linked, setLinked] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    const session = await fetch("/api/account/session", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
    if (!session?.signedIn) { setSignedIn(false); return; }
    setSignedIn(true);
    const response = await fetch("/api/account/telegram/manual", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as ManualState;
    if (response.ok) { setLinked(Boolean(data.linked)); setBotUsername(data.botUsername || ""); }
  };

  useEffect(() => { void load(); }, []);
  if (!signedIn) return null;

  const save = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/account/telegram/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: token, chatId }) });
      const data = await response.json().catch(() => ({})) as ManualState & { message?: string };
      if (!response.ok) throw new Error(data.error || "تعذر ربط Telegram يدويًا");
      setLinked(true); setBotUsername(data.botUsername || ""); setToken(""); setChatId("");
      setNotice(data.message || "تم الربط وإرسال رسالة اختبار.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر ربط Telegram يدويًا"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setNotice("");
    const response = await fetch("/api/account/telegram/manual", { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as ManualState;
    setBusy(false);
    if (!response.ok) { setNotice(data.error || "تعذر فصل البوت الشخصي"); return; }
    setLinked(false); setBotUsername(""); setNotice("تم فصل البوت الشخصي.");
  };

  return <section className="account-card telegram-manual-card">
    <span>Telegram بديل</span>
    <h2>اربط بوتك الشخصي</h2>
    <p>هذا خيار إضافي بجانب بوت NAVIXA الرسمي. التوكن وChat ID يُحفظان مشفرين، ونرسل رسالة اختبار قبل اعتماد الربط.</p>
    {linked ? <>
      <div className="account-status"><b>البوت الشخصي مرتبط ✅</b><small>{botUsername ? `@${botUsername}` : "تم التحقق من الاتصال"}</small></div>
      <button className="account-secondary" disabled={busy} onClick={() => void remove()}>{busy ? "جارٍ التنفيذ…" : "فصل البوت الشخصي"}</button>
    </> : <>
      <label>Bot Token<input type="password" value={token} onChange={e => setToken(e.target.value.trim())} placeholder="123456789:AA..." autoComplete="off" /></label>
      <label>Chat ID<input type="text" inputMode="numeric" value={chatId} onChange={e => setChatId(e.target.value.replace(/[^0-9-]/g, ""))} placeholder="123456789" autoComplete="off" /></label>
      <button disabled={busy || token.length < 20 || chatId.length < 4} onClick={() => void save()}>{busy ? "جارٍ الاختبار…" : "اختبر واربط"}</button>
    </>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
  </section>;
}
