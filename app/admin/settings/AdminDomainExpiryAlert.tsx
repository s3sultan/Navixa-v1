"use client";
import { useEffect, useState } from "react";

type Status = { domain: string; expiresAt: string; daysRemaining: number; lastAlertAt: string; warning: boolean; externalConfigured: boolean };

export default function AdminDomainExpiryAlert() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    const response = await fetch("/api/admin/domain-expiry", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as Status & { error?: string };
    if (!response.ok) { setError(data.error || "تعذر قراءة حالة الدومين"); return; }
    setStatus(data); setError("");
  };
  useEffect(() => { void load(); }, []);
  return <section className="panel domain-expiry-admin" aria-label="تنبيه انتهاء الدومين">
    <div className="panel-head"><div><small>حماية الهوية الرقمية</small><h2>مراقبة انتهاء الدومين</h2><p>تنبيه خاص بالمدير فقط قبل انتهاء الدومين بـ40 يومًا أو أقل.</p></div><button onClick={() => void load()}>تحديث</button></div>
    {error && <p className="admin-inline-notice">{error}</p>}
    {status && <div className="subscription-summary"><article><small>الدومين</small><b>{status.domain}</b><span>{status.expiresAt.slice(0, 10)}</span></article><article><small>المتبقي</small><b className={status.warning ? "domain-expiry-warning" : ""}>{status.daysRemaining} يومًا</b><span>{status.warning ? "يحتاج متابعة" : "لا يوجد تحذير حاليًا"}</span></article><article><small>التنبيه الخارجي</small><b>{status.externalConfigured ? "مهيأ" : "ينتظر الأسرار"}</b><span>{status.lastAlertAt ? `آخر إرسال: ${status.lastAlertAt.slice(0, 10)}` : "لم يُرسل بعد"}</span></article></div>}
  </section>;
}
