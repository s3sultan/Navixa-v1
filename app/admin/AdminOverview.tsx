"use client";

import { useEffect, useState } from "react";

type Usage = { summary: { accounts: number; logins: number; minutes: number }; visitors?: { todayEntrances: number; todayPageviews: number; topPages: { path: string; views: number }[]; timezone: string }; features: { path: string; uses: number; seconds: number }[] };
type Performance = { current: { path: string; samples: number; avg_load_ms: number; p95_load_ms: number; avg_lcp_ms: number }[]; evidence: { minimumSamples: number } };
type Health = { reports: { status: string; week_start: string }[] };
type RuntimeFeatures = { features?: Record<string, boolean> };
type Props = { onNavigate: (name: string, id: string) => void };
const labels: Record<string, string> = { "/": "الرئيسية", "/pricing": "الأسعار", "/today": "يومي", "/worship": "الورد", "/health": "الصحة", "/meetings": "الاجتماعات", "/plus": "هِمّة", "/sprint": "عَزْم" };
const fetchJson = async <T,>(url: string): Promise<T | null> => { const response = await fetch(url, { cache: "no-store" }); return response.ok ? response.json() as Promise<T> : null; };

export default function AdminOverview({ onNavigate }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null); const [performance, setPerformance] = useState<Performance | null>(null); const [health, setHealth] = useState<Health | null>(null); const [runtime, setRuntime] = useState<RuntimeFeatures | null>(null); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const [u,p,h,r] = await Promise.all([fetchJson<Usage>("/api/admin/usage-analytics"), fetchJson<Performance>("/api/admin/performance"), fetchJson<Health>("/api/admin/site-health"), fetchJson<RuntimeFeatures>("/api/admin/runtime-features")]); setUsage(u); setPerformance(p); setHealth(h); setRuntime(r); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const mainPerformance = performance?.current.find(item => item.path === "/"); const adequateSample = Boolean(mainPerformance && performance && mainPerformance.samples >= performance.evidence.minimumSamples); const healthValue = health?.reports[0]?.status === "healthy" ? "سليم" : health?.reports.length ? "مراجعة" : "بانتظار";
  const topPages = usage?.visitors?.topPages || []; const maxViews = Math.max(1, ...topPages.map(item => item.views)); const enabledFeatures = runtime?.features ? Object.values(runtime.features).filter(Boolean).length : null;
  const cards = [
    { label: "زيارات اليوم", value: usage?.visitors ? String(usage.visitors.todayEntrances) : "—", detail: "دخول الصفحة الرئيسية · توقيت الرياض", target: "activity" },
    { label: "مشاهدات الصفحات", value: usage?.visitors ? String(usage.visitors.todayPageviews) : "—", detail: "اليوم حتى الآن", target: "activity" },
    { label: "الحسابات", value: usage ? String(usage.summary.accounts) : "—", detail: "حسابات مسجلة", target: "activity" },
    { label: "صحة الموقع", value: healthValue, detail: enabledFeatures === null ? "آخر فحص دفاعي" : `${enabledFeatures} مفاتيح تشغيل مفعلة`, target: "site-health" },
  ];
  return <section className="admin-overview" aria-label="نظرة عامة تشغيلية">
    <div className="admin-overview-heading"><div><small>اليوم</small><h2>نبض NAVIXA بعد الإطلاق</h2><p>الأهم أمامك مباشرة. التفاصيل والإعدادات الأقل استخدامًا تبقى داخل أقسامها.</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "جارٍ التحديث…" : "تحديث البيانات"}</button></div>
    <div className="admin-kpi-grid">{cards.map(card => <button type="button" className="admin-kpi" key={card.label} onClick={() => onNavigate(card.target === "site-health" ? "الصحة" : "الاستخدام", card.target)}><span><small>{card.label}</small><b>{card.value}</b><em>{card.detail}</em></span><i>←</i></button>)}</div>
    <div className="admin-overview-lower">
      <section className="admin-overview-panel admin-feature-spotlight"><div className="admin-overview-panel-head"><div><small>اليوم</small><h3>الصفحات الأكثر زيارة</h3></div><button type="button" onClick={() => onNavigate("الاستخدام", "activity")}>التفاصيل ←</button></div>{topPages.length ? <ol className="admin-feature-bars">{topPages.map(item => <li key={item.path}><div><b>{labels[item.path] || item.path}</b><small>{item.views} مشاهدة</small></div><span><i style={{ width: `${Math.max(8, Math.round((item.views / maxViews) * 100))}%` }} /></span></li>)}</ol> : <p className="admin-empty-state">تبدأ الإحصائية من نشر هذا التحديث، ولا تعرض أرقامًا تقديرية.</p>}</section>
      <section className="admin-overview-panel admin-performance-spotlight"><div className="admin-overview-panel-head"><div><small>الأداء</small><h3>الصفحة الرئيسية</h3></div><button type="button" onClick={() => onNavigate("الأداء", "performance")}>التفاصيل ←</button></div>{adequateSample && mainPerformance ? <div className="performance-readout"><strong>{Math.round(mainPerformance.avg_load_ms)}<small>ms متوسط التحميل</small></strong><dl><div><dt>P95</dt><dd>{Math.round(mainPerformance.p95_load_ms)}ms</dd></div><div><dt>LCP</dt><dd>{Math.round(mainPerformance.avg_lcp_ms)}ms</dd></div></dl></div> : <p className="admin-empty-state">بانتظار عينة كافية قبل عرض قراءة أداء موثوقة.</p>}</section>
      <section className="admin-overview-panel admin-operation-spotlight"><div><small>اختصارات</small><h3>الأكثر استخدامًا</h3></div><div className="admin-operation-links"><button type="button" onClick={() => onNavigate("الاشتراكات", "subscriptions")}>الاشتراكات والأسعار <i>←</i></button><button type="button" onClick={() => onNavigate("الإعدادات", "settings")}>إعدادات المنصة <i>←</i></button><button type="button" onClick={() => { window.location.href = "/admin/support"; }}>الدعم الموحد <i>↗</i></button></div></section>
    </div>
  </section>;
}
