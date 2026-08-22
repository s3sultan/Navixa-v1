"use client";

import { useEffect, useState } from "react";

type ServiceState = {
  activeProvider: string;
  activeDomain: string;
  candidateProvider: "moyasar" | "hyperpay" | "paytabs" | "tap" | "other";
  candidateDomain: string;
  requestedSender: string;
  replyTo: string;
  senderConfigured: boolean;
  links: { cloudflareDns: string; cloudflareEmailRouting: string; cloudflareWorker: string; resendDomains: string };
};

const initial: ServiceState = { activeProvider: "moyasar", activeDomain: "navixasa.com", candidateProvider: "moyasar", candidateDomain: "", requestedSender: "", replyTo: "", senderConfigured: false, links: { cloudflareDns: "#", cloudflareEmailRouting: "#", cloudflareWorker: "#", resendDomains: "#" } };

export default function AdminServiceTransitionSettings() {
  const [state, setState] = useState<ServiceState>(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await fetch("/api/admin/service-transition", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as ServiceState & { error?: string };
    if (!response.ok) { setNotice(data.error || "تعذر قراءة إعدادات الانتقال"); return; }
    setState(data); setNotice("");
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/service-transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateProvider: state.candidateProvider, candidateDomain: state.candidateDomain, requestedSender: state.requestedSender, replyTo: state.replyTo }) });
    const data = await response.json().catch(() => ({})) as ServiceState & { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) { setNotice(data.error || "تعذر حفظ خطة الانتقال"); return; }
    setState(data); setNotice(data.message || "تم حفظ خطة الانتقال");
  };
  return <section className="panel domain-expiry-admin service-transition-admin" aria-label="نقل بوابة الدفع والدومين والبريد">
    <div className="panel-head"><div><small>تحكم تشغيلي</small><h2>مركز نقل الخدمات</h2><p>خطط تغيير بوابة الدفع أو الدومين أو عناوين البريد من مكان واحد، ثم أكمل التحقق الرسمي قبل أي تحويل حي.</p></div><button onClick={() => void load()}>تحديث</button></div>
    {notice && <p className="admin-inline-notice">{notice}</p>}
    <div className="subscription-summary"><article><small>بوابة الدفع الحالية</small><b>{state.activeProvider}</b><span>لا تتغير إلا بعد اختبار حي</span></article><article><small>دومين NAVIXA الحالي</small><b>{state.activeDomain}</b><span>يتطلب DNS واستضافة عند الاستبدال</span></article><article><small>مرسل البريد</small><b>{state.senderConfigured ? "جاهز" : "غير مهيأ"}</b><span>Resend ونطاق موثّق</span></article></div>
    <div className="subscription-create"><div><small>خطة انتقال محفوظة</small><b>حدّد التغيير القادم</b><p>حفظ الخطة لا يغيّر التحصيل أو DNS أو رسائل العملاء تلقائيًا.</p></div><label>بوابة الدفع القادمة<select value={state.candidateProvider} onChange={event => setState(previous => ({ ...previous, candidateProvider: event.target.value as ServiceState["candidateProvider"] }))}><option value="moyasar">Moyasar</option><option value="hyperpay">HyperPay</option><option value="paytabs">PayTabs</option><option value="tap">Tap Payments</option><option value="other">مزود آخر</option></select></label><input value={state.candidateDomain} onChange={event => setState(previous => ({ ...previous, candidateDomain: event.target.value }))} placeholder="الدومين القادم، مثل navixa.sa" aria-label="الدومين القادم"/><input value={state.requestedSender} onChange={event => setState(previous => ({ ...previous, requestedSender: event.target.value }))} placeholder="مرسل البريد القادم، مثل login@navixa.sa" type="email" aria-label="مرسل البريد القادم"/><input value={state.replyTo} onChange={event => setState(previous => ({ ...previous, replyTo: event.target.value }))} placeholder="بريد الردود والإدارة" type="email" aria-label="بريد الردود والإدارة"/><button disabled={busy} onClick={() => void save()}>{busy ? "جارٍ الحفظ…" : "حفظ خطة الانتقال"}</button></div>
    <div className="admin-actions compact"><a href={state.links.cloudflareDns} target="_blank" rel="noreferrer">DNS في Cloudflare ↗</a><a href={state.links.cloudflareEmailRouting} target="_blank" rel="noreferrer">استقبال بريد الدومين ↗</a><a href={state.links.resendDomains} target="_blank" rel="noreferrer">تحقق نطاق الإرسال في Resend ↗</a><a href={state.links.cloudflareWorker} target="_blank" rel="noreferrer">أسرار Worker ↗</a></div>
    <p className="panel-intro">عند تغيير بوابة الدفع: أضف مفاتيحها أولًا، اختبرها، ثم غيّر مزود الخطة وبعدها فقط افتح Checkout. عند تغيير الدومين: أضف الدومين في الاستضافة وDNS وResend، تحقّق منه، ثم حدّث مرسل البريد وروابط الموقع.</p>
  </section>;
}
