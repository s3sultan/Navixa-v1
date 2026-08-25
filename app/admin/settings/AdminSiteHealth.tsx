"use client";

import { useEffect, useState } from "react";
import "./usage-analytics.css";

type Check = { key: string; ok: boolean; detail: string };
type Report = { week_start: string; status: string; checks_json: string; alerted_at: string; email_sent: number; telegram_sent: number };
type Csp = { bucket_day: string; directive: string; blocked_host: string; report_count: number; last_seen_at: string };
type Data = { reports: Report[]; csp: Csp[] };

export default function AdminSiteHealth() {
  const [data, setData] = useState<Data | null>(null); const [notice, setNotice] = useState("");
  const load = async () => { const response = await fetch("/api/admin/site-health", { cache: "no-store" }); if (!response.ok) { setNotice("تعذر تحميل فحص الموقع"); return; } setData(await response.json()); };
  useEffect(() => { void load(); }, []);
  const checks = (report: Report) => { try { return JSON.parse(report.checks_json) as Check[]; } catch { return []; } };
  return <section className="usage-analytics-admin" aria-label="صحة الموقع وتقارير CSP"><div className="panel-head"><div><small>فحص أسبوعي دفاعي</small><h2>صحة الموقع وتوافق CSP</h2><p>يفحص صفحات عامة ورؤوس الحماية فقط. لا يجرب تسجيل الدخول أو كلمات المرور أو بيانات المستخدمين.</p></div><button onClick={() => void load()}>تحديث</button></div>{notice && <p className="admin-inline-notice">{notice}</p>}{data && <div className="usage-analytics-grid"><section><h3>آخر فحص أسبوعي</h3>{data.reports.length ? <ol>{data.reports.map(report => <li key={report.week_start}><b>{report.status === "healthy" ? "سليم" : "يتطلب مراجعة"}</b><span>{new Date(report.week_start).toLocaleDateString("ar-SA")} · {checks(report).filter(check => !check.ok).length ? `${checks(report).filter(check => !check.ok).length} ملاحظات` : "كل الفحوصات سليمة"}{report.alerted_at ? " · أُبلغ المدير" : ""}</span></li>)}</ol> : <p>سيظهر أول سجل بعد تشغيل الفحص الأسبوعي في Worker.</p>}</section><section><h3>تقارير توافق CSP — آخر 30 يومًا</h3>{data.csp.length ? <ol>{data.csp.map((report, index) => <li key={`${report.bucket_day}-${report.directive}-${index}`}><b>{report.directive}</b><span>{report.blocked_host} · {report.report_count} تقرير · {new Date(report.last_seen_at).toLocaleString("ar-SA")}</span></li>)}</ol> : <p>لا توجد حظرات توافق مسجلة بعد.</p>}</section></div>}</section>;
}
