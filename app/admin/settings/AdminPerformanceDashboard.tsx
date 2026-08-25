"use client";

import { useEffect, useState } from "react";
import "./usage-analytics.css";

type Metric = { path: string; samples: number; avg_ttfb_ms: number; avg_load_ms: number; p95_load_ms: number; avg_lcp_ms: number; p95_lcp_ms: number; avg_inp_ms: number; p95_inp_ms: number; avg_cls_milli: number };
type Data = { current: Metric[]; previous: Metric[]; evidence: { minimumSamples: number } };
const names: Record<string, string> = { "/": "الرئيسية", "/health": "الصحة" };
const metricText = (value: number | null | undefined) => value ? `${value}ms` : "—";

export default function AdminPerformanceDashboard() {
  const [data, setData] = useState<Data | null>(null); const [notice, setNotice] = useState("");
  const load = async () => { const response = await fetch("/api/admin/performance", { cache: "no-store" }); if (!response.ok) { setNotice("تعذر تحميل مؤشرات الأداء"); return; } setData(await response.json()); };
  useEffect(() => { void load(); }, []);
  const previous = (path: string) => data?.previous.find(item => item.path === path);
  const change = (now: number, before: number | undefined) => before ? `${now <= before ? "تحسن" : "أبطأ"} ${Math.abs(Math.round(((now - before) / before) * 100))}%` : "لا مقارنة بعد";
  return <section className="usage-analytics-admin" aria-label="أداء NAVIXA الميداني"><div className="panel-head"><div><small>أداء ميداني مجهول الهوية</small><h2>سرعة NAVIXA الأسبوعية</h2><p>تعرض هذه اللوحة تجميعات من الزوار فقط؛ لا تخزن حسابًا أو IP أو محتوى أو سجل تصفح.</p></div><button onClick={() => void load()}>تحديث</button></div>{notice && <p className="admin-inline-notice">{notice}</p>}{data && <><p className="admin-inline-notice">لا تظهر المقارنة كدليل موثوق إلا عند توفر {data.evidence.minimumSamples} عينات أو أكثر لكل مسار.</p><div className="usage-analytics-grid">{data.current.length ? data.current.map(item => <section key={item.path}><h3>{names[item.path] || item.path}</h3><ol><li><b>العينات</b><span>{item.samples} · {item.samples >= data.evidence.minimumSamples ? "كافية" : "قيد التجميع"}</span></li><li><b>TTFB / تحميل</b><span>{metricText(item.avg_ttfb_ms)} / {metricText(item.avg_load_ms)} · {change(item.avg_load_ms, previous(item.path)?.avg_load_ms)}</span></li><li><b>LCP / INP / CLS</b><span>{metricText(item.avg_lcp_ms)} / {metricText(item.avg_inp_ms)} / {item.avg_cls_milli ?? "—"}‰</span></li><li><b>P95 للتحميل</b><span>{metricText(item.p95_load_ms)} · P95 LCP {metricText(item.p95_lcp_ms)}</span></li></ol></section>) : <p>بانتظار عينات أداء ميدانية كافية من الصفحات العامة.</p>}</div></>}</section>;
}
