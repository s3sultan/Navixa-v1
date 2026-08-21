"use client";

import { useEffect, useState } from "react";

type Settings = { userAuthEnabled: boolean; emailOtpEnabled: boolean; passkeysEnabled: boolean; earlyAccessEnabled: boolean; trialDays: number };
type Readiness = { emailProviderConfigured: boolean; users: number; activeSessions: number };
const initial: Settings = { userAuthEnabled: false, emailOtpEnabled: false, passkeysEnabled: false, earlyAccessEnabled: false, trialDays: 14 };
const headers = { "Content-Type": "application/json" };

export default function AdminUserAuthSettings() {
  const [settings, setSettings] = useState<Settings>(initial);
  const [readiness, setReadiness] = useState<Readiness>({ emailProviderConfigured: false, users: 0, activeSessions: 0 });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await fetch("/api/admin/user-auth-settings", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { settings?: Settings; readiness?: Readiness };
    setSettings(data.settings || initial); setReadiness(data.readiness || { emailProviderConfigured: false, users: 0, activeSessions: 0 });
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/user-auth-settings", { method: "POST", headers, body: JSON.stringify(settings) });
    const data = await response.json().catch(() => ({}));
    setBusy(false); setNotice(response.ok ? (data.message || "تم حفظ إعدادات الحساب") : (data.error || "تعذر حفظ الإعدادات"));
    if (response.ok) await load();
  };
  const setFlag = (key: "userAuthEnabled" | "passkeysEnabled" | "earlyAccessEnabled", value: boolean) => setSettings(previous => ({ ...previous, [key]: value }));
  return <section className="panel subscription-admin user-auth-admin" aria-label="حسابات مستخدمي NAVIXA">
    <div className="panel-head"><div><small>NAVIXA Plus · حسابات المستخدمين</small><h2>تجربة Early Access بهوية خاصة</h2><p>لا تتصل هذه الحسابات بتسجيلات الاجتماعات أو النصوص المحلية. يبقى الدفع العام مخفيًا حتى يكتمل الاختبار الحي.</p></div><button onClick={() => void load()}>تحديث</button></div>
    {notice && <p className="admin-inline-notice">{notice}</p>}
    <div className="subscription-summary user-auth-summary"><article><small>مزود بريد الدخول</small><b>{readiness.emailProviderConfigured ? "جاهز" : "غير مهيأ"}</b><span>{readiness.emailProviderConfigured ? "يمكن تفعيل رموز الدخول" : "يتطلب نطاقًا وبريد إرسال"}</span></article><article><small>حسابات المستخدمين</small><b>{readiness.users}</b><span>لا تشمل بيانات محلية</span></article><article><small>جلسات نشطة</small><b>{readiness.activeSessions}</b><span>جلسات خادمية آمنة</span></article><article><small>تجربة Plus</small><b>{settings.trialDays}</b><span>يومًا بلا بطاقة</span></article></div>
    <section className="billing-control user-auth-control"><div className="billing-control-head"><div><small>فتح تدريجي ومحمي</small><h3>الدخول بلا كلمة مرور</h3><p>يفعّل البريد رمزًا لمرة واحدة، ثم يمكن للمستخدم تفعيل Passkey ببصمة الجهاز أو Face ID. لا يوجد تخزين للصوت أو النصوص في الحساب.</p></div><span className={settings.userAuthEnabled ? "billing-state live" : "billing-state locked"}>{settings.userAuthEnabled ? "قيد التفعيل" : "مقفل"}</span></div>
      <div className="billing-flags"><label><input type="checkbox" checked={settings.userAuthEnabled} disabled={!readiness.emailProviderConfigured} onChange={event => setFlag("userAuthEnabled", event.target.checked)}/><span><b>فتح حسابات المستخدمين</b><small>{readiness.emailProviderConfigured ? "يُفعّل رمز البريد لمرة واحدة فقط." : "أضف مزود البريد وعنوان الإرسال أولًا."}</small></span></label><label><input type="checkbox" checked={settings.passkeysEnabled} disabled={!settings.userAuthEnabled} onChange={event => setFlag("passkeysEnabled", event.target.checked)}/><span><b>تفعيل Passkeys</b><small>دخول سريع اختياري بالبصمة أو قفل الجهاز بعد أول تحقق بالبريد.</small></span></label><label><input type="checkbox" checked={settings.earlyAccessEnabled} disabled={!settings.userAuthEnabled} onChange={event => setFlag("earlyAccessEnabled", event.target.checked)}/><span><b>فتح تجربة Plus Early Access</b><small>تجربة {settings.trialDays} يومًا مرتبطة بحساب موثق، من دون دفع عام.</small></span></label></div>
      <label className="user-auth-trial">مدة التجربة <select value={settings.trialDays} onChange={event => setSettings(previous => ({ ...previous, trialDays: Number(event.target.value) }))}><option value={7}>7 أيام</option><option value={14}>14 يومًا</option><option value={21}>21 يومًا</option></select></label>
      <div className="billing-actions"><button disabled={busy} onClick={() => void save()}>{busy ? "جارٍ الحفظ…" : "حفظ إعدادات الحساب"}</button><code>الدفع العام: مقفل</code></div>
    </section>
  </section>;
}
