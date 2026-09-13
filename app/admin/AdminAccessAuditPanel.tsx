"use client";

import { useCallback, useEffect, useState } from "react";
import "./admin-audit.css";

type Permission = { key: string; label: string; detail: string };
type Activity = {
  id: number;
  admin_email: string;
  action: string;
  resource: string;
  outcome: "success" | "failure";
  metadata_json: string | null;
  created_at: string;
};
type Payload = {
  identity?: { email: string; role: string };
  permissions?: Permission[];
  items?: Activity[];
  error?: string;
};

const actionLabel = (value: string) => value === "runtime_features.update" ? "تحديث مفاتيح التشغيل" : value.replaceAll("_", " ").replaceAll(".", " · ");
const resourceLabel = (value: string) => value === "runtime_features" ? "مفاتيح الميزات" : value;

export default function AdminAccessAuditPanel({ mode }: { mode: "permissions" | "activity" }) {
  const [data, setData] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/activity?limit=40", { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || "تعذر قراءة بيانات الإدارة");
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر قراءة بيانات الإدارة");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (mode === "permissions") return <section className="panel admin-access-panel">
    <div className="panel-head"><div><small>صلاحيات الخادم</small><h2>صلاحيات الجلسة الحالية</h2></div><span className="full-access">{data.identity?.role === "admin" ? "مدير" : "محمية"}</span></div>
    <p className="panel-intro">هذه الصلاحيات قادمة من الجلسة الموثقة ويُتحقق منها على الخادم، وليست قائمة شكلية في الواجهة.</p>
    {data.identity?.email && <p className="admin-session-identity"><span>الجلسة</span><b dir="ltr">{data.identity.email}</b></p>}
    {loading && <p className="admin-audit-state">جارٍ تحميل الصلاحيات…</p>}
    {error && <p className="admin-audit-state is-error">{error}</p>}
    {!loading && !error && <div className="permission-list">{(data.permissions || []).map(permission => <div className="permission-row" key={permission.key}><span>✓</span><div><b>{permission.label}</b><small>{permission.detail}</small></div><em dir="ltr">{permission.key}</em></div>)}</div>}
  </section>;

  return <section className="panel admin-audit-panel">
    <div className="panel-head"><div><small>سجل موثّق</small><h2>آخر الإجراءات الإدارية</h2></div><button type="button" className="admin-audit-refresh" onClick={() => void load()} disabled={loading}>{loading ? "جارٍ التحديث…" : "تحديث"}</button></div>
    <p className="panel-intro">يسجل الإجراء والجزء المتأثر والنتيجة فقط. كلمات المرور والجلسات والمفاتيح وOTP لا تُحفظ في السجل.</p>
    {error && <p className="admin-audit-state is-error">{error}</p>}
    {!loading && !error && !(data.items || []).length && <p className="admin-audit-state">لا توجد إجراءات مسجلة بعد. يبدأ السجل مع العمليات الإدارية الجديدة.</p>}
    <div className="admin-audit-list">{(data.items || []).map(item => <article key={item.id} className={item.outcome === "failure" ? "is-failure" : ""}>
      <span className="admin-audit-result">{item.outcome === "success" ? "✓" : "!"}</span>
      <div><b>{actionLabel(item.action)}</b><small>{resourceLabel(item.resource)} · <span dir="ltr">{item.admin_email}</span></small></div>
      <time dateTime={item.created_at}>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</time>
    </article>)}</div>
  </section>;
}
