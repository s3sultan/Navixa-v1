"use client";

import { useEffect, useState } from "react";

type Usage = { summary: { accounts: number; logins: number; minutes: number }; features: { path: string; uses: number; seconds: number }[] };
type Performance = { current: { path: string; samples: number; avg_load_ms: number; p95_load_ms: number; avg_lcp_ms: number }[]; evidence: { minimumSamples: number } };
type Health = { reports: { status: string; week_start: string }[] };
type Runtime = { features: Record<string, boolean> };
type Props = { onNavigate: (name: string, id: string) => void };

const labels: Record<string, string> = { "/": "الرئيسية", "/today": "يومي", "/worship": "الورد", "/health": "الصحة", "/meetings": "الاجتماعات" };
const fetchJson = async <T,>(url: string): Promise<T | null> => {
  const response = await fetch(url, { cache: "no-store" });
  return response.ok ? response.json() as Promise<T> : null;
};

export default function AdminOverview({ onNavigate }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [nextUsage, nextPerformance, nextHealth, nextRuntime] = await Promise.all([
      fetchJson<Usage>("/api/admin/usage-analytics"),
      fetchJson<Performance>("/api/admin/performance"),
      fetchJson<Health>("/api/admin/site-health"),
      fetchJson<Runtime>("/api/admin/runtime-features"),
    ]);
    setUsage(nextUsage); setPerformance(nextPerformance); setHealth(nextHealth); setRuntime(nextRuntime); setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const healthValue = health?.reports[0]?.status === "healthy" ? "سليم" : health?.reports.length ? "مراجعة" : "بانتظار";
  const activeFeatures = runtime ? Object.values(runtime.features).filter(Boolean).length : null;
  const mainPerformance = performance?.current.find(item => item.path === "/");
  const adequateSample = Boolean(mainPerformance && performance && mainPerformance.samples >= performance.evidence.minimumSamples);
  const topFeatures = usage?.features.slice(0, 3) || [];
  const maxUses = Math.max(1, ...topFeatures.map(item => item.uses));

  const cards = [
    { label: "الحسابات", value: usage ? String(usage.summary.accounts) : "—", detail: "حسابات مسجلة", icon: "◌", target: "activity", action: "السجل" },
    { label: "مرات الدخول", value: usage ? String(usage.summary.logins) : "—", detail: "من التقرير المحمي", icon: "↗", target: "activity", action: "السجل" },
    { label: "صحة الموقع", value: healthValue, detail: "آخر فحص دفاعي", icon: "✓", target: "site-health", action: "الصحة" },
    { label: "الميزات الثانوية", value: activeFeatures === null ? "—" : `${activeFeatures}/7`, detail: "مفعّلة حاليًا", icon: "◈", target: "features", action: "التحكم" },
  ];

  return <section className="admin-overview" aria-label="نظرة عامة تشغيلية">
    <div className="admin-overview-heading"><div><small>نظرة عامة</small><h2>متابعة المنصة من مكان واحد</h2><p>تعتمد البطاقات على بيانات الإدارة المتاحة فقط؛ وعند عدم توفر عينة تعرض حالة انتظار بدل رقم تقديري.</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "جارٍ التحديث…" : "تحديث البيانات"}</button></div>
    <div className="admin-kpi-grid">{cards.map(card => <button type="button" className="admin-kpi" key={card.label} onClick={() => onNavigate(card.action, card.target)}><span className="admin-kpi-icon">{card.icon}</span><span><small>{card.label}</small><b>{card.value}</b><em>{card.detail}</em></span><i>←</i></button>)}</div>
    <div className="admin-overview-lower">
      <section className="admin-overview-panel admin-performance-spotlight"><div className="admin-overview-panel-head"><div><small>الأداء الأسبوعي</small><h3>سرعة الصفحة الرئيسية</h3></div><button type="button" onClick={() => onNavigate("الأداء", "performance")}>التفاصيل ←</button></div>{adequateSample && mainPerformance ? <div className="performance-readout"><strong>{Math.round(mainPerformance.avg_load_ms)}<small>ms متوسط التحميل</small></strong><dl><div><dt>P95 تحميل</dt><dd>{Math.round(mainPerformance.p95_load_ms)}ms</dd></div><div><dt>LCP</dt><dd>{Math.round(mainPerformance.avg_lcp_ms)}ms</dd></div><div><dt>العينات</dt><dd>{mainPerformance.samples}</dd></div></dl></div> : <p className="admin-empty-state">{performance ? `بانتظار ${performance.evidence.minimumSamples} عينات على الأقل قبل عرض قراءة أداء موثوقة.` : "تعذر جلب قراءة الأداء الآن؛ افتح لوحة الأداء لإعادة المحاولة."}</p>}</section>
      <section className="admin-overview-panel admin-feature-spotlight"><div className="admin-overview-panel-head"><div><small>الاستخدام المجمع</small><h3>المزايا الأكثر فتحًا</h3></div><button type="button" onClick={() => onNavigate("السجل", "activity")}>التقرير ←</button></div>{topFeatures.length ? <ol className="admin-feature-bars">{topFeatures.map(item => <li key={item.path}><div><b>{labels[item.path] || item.path}</b><small>{item.uses} فتحات · {Math.round(item.seconds / 60)} د</small></div><span><i style={{ width: `${Math.max(8, Math.round((item.uses / maxUses) * 100))}%` }} /></span></li>)}</ol> : <p className="admin-empty-state">{runtime?.features.usageAnalyticsEnabled === false ? "التحليلات المجمعة متوقفة من مفاتيح التشغيل." : "ستظهر البيانات بعد استخدام المزايا."}</p>}</section>
      <section className="admin-overview-panel admin-operation-spotlight"><div><small>إجراءات موثوقة</small><h3>ابدأ من القسم الصحيح</h3></div><div className="admin-operation-links"><button type="button" onClick={() => onNavigate("الميزات", "features")}>إدارة مفاتيح التشغيل <i>←</i></button><button type="button" onClick={() => onNavigate("الإعدادات", "settings")}>ضبط الدخول والتنبيهات <i>←</i></button><button type="button" onClick={() => { window.location.href = "/admin/support"; }}>فتح الدعم الموحد <i>↗</i></button></div></section>
    </div>
  </section>;
}
