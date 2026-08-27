"use client";

import { useEffect, useState } from "react";

type Settings = {
  floating_assistant_enabled: "true" | "false";
  game_ad_enabled: "true" | "false";
  health_nudge_enabled: "true" | "false";
  member_platform_ribbon_enabled: "true" | "false";
  matches_home_enabled: "true" | "false";
  usage_analytics_enabled: "true" | "false";
  public_counter_enabled: "true" | "false";
};

const initial: Settings = {
  floating_assistant_enabled: "false",
  game_ad_enabled: "false",
  health_nudge_enabled: "false",
  member_platform_ribbon_enabled: "false",
  matches_home_enabled: "false",
  usage_analytics_enabled: "false",
  public_counter_enabled: "false",
};

const fields: Array<{ key: keyof Settings; title: string; detail: string }> = [
  { key: "floating_assistant_enabled", title: "المساعد العائم", detail: "يمنع تحميل واجهة المحادثة وطلب أنماط المساعد حتى تعيد تشغيله." },
  { key: "game_ad_enabled", title: "بطاقة الإعلان الجانبية", detail: "يبقي الإعلان الثانوي مخفيًا لتقليل التشتت في البداية." },
  { key: "health_nudge_enabled", title: "تذكير الحركة العائم", detail: "لا يمس صفحة صحتي أو بيانات الجهاز؛ يوقف التذكير المنبثق فقط." },
  { key: "member_platform_ribbon_enabled", title: "شريط منصات العضوية", detail: "يوقف طلب حالة العضوية والشريط التسويقي المتحرك في الرئيسية." },
  { key: "matches_home_enabled", title: "مباريات الرئيسية", detail: "يوقف طلب المصدر الرياضي والفحص الدوري والعدادات على الرئيسية فقط." },
  { key: "usage_analytics_enabled", title: "تحليلات الاستخدام المجمعة", detail: "يوقف أحداث فتح الصفحة والنقر والمدة؛ لا يوقف قياسات صحة الموقع أو الأخطاء الدفاعية." },
  { key: "public_counter_enabled", title: "عداد الزيارات العام", detail: "يخفي العداد ويوقف تسجيل زيارته العامة من الصفحة الرئيسية." },
];

export default function AdminRuntimeFeatureSettings() {
  const [settings, setSettings] = useState<Settings>(initial);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const response = await fetch("/api/admin/runtime-features", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { settings?: Settings; error?: string };
    if (response.ok && data.settings) setSettings(data.settings);
    else setNotice(data.error || "تعذر تحميل مفاتيح التشغيل");
  };
  useEffect(() => { void load(); }, []);
  const setFlag = (key: keyof Settings, enabled: boolean) => setSettings(current => ({ ...current, [key]: String(enabled) as "true" | "false" }));
  const save = async () => {
    setSaving(true); setNotice("");
    const response = await fetch("/api/admin/runtime-features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floatingAssistantEnabled: settings.floating_assistant_enabled === "true",
        gameAdEnabled: settings.game_ad_enabled === "true",
        healthNudgeEnabled: settings.health_nudge_enabled === "true",
        memberPlatformRibbonEnabled: settings.member_platform_ribbon_enabled === "true",
        matchesHomeEnabled: settings.matches_home_enabled === "true",
        usageAnalyticsEnabled: settings.usage_analytics_enabled === "true",
        publicCounterEnabled: settings.public_counter_enabled === "true",
      }),
    });
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    setSaving(false); setNotice(response.ok ? (data.message || "تم الحفظ") : (data.error || "تعذر حفظ الإعدادات"));
    if (response.ok) await load();
  };
  return <section className="panel subscription-admin">
    <div className="panel-head"><div><small>تحكم حقيقي ومحفوظ</small><h2>تخفيف الميزات الثانوية</h2><p>تبدأ هذه العناصر متوقفة لتخفيف أول زيارة. لا تمس هذه المفاتيح الحساب أو يومي أو الورد أو الدعم أو الدفع.</p></div><button type="button" onClick={() => void load()}>تحديث</button></div>
    {notice && <p className="admin-inline-notice">{notice}</p>}
    <div className="billing-flags">{fields.map(field => <label key={field.key}><input type="checkbox" checked={settings[field.key] === "true"} onChange={event => setFlag(field.key, event.target.checked)} /><span><b>{field.title}</b><small>{field.detail}</small></span></label>)}</div>
    <div className="billing-actions"><button type="button" disabled={saving} onClick={() => void save()}>{saving ? "جارٍ الحفظ…" : "حفظ مفاتيح التشغيل"}</button><code>لا تُحفظ أسرار أو محتوى مستخدم أو معلومات دفع في هذه الإعدادات</code></div>
  </section>;
}
