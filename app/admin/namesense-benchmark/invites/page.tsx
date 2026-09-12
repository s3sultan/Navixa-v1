"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../../useAdminAuth";
import "./invites.css";

type Accent = "en-IN" | "en-PH" | "en-US" | "en-GB" | "ar-GULF" | "ar-EG" | "ar-SY" | "ar-MA" | "ar-DZ";
type InviteRow = {
  invite_id: string;
  speaker_id: string;
  accent: Accent;
  max_trials: number;
  used_trials: number;
  expires_at: string;
  revoked: number;
  created_at: string;
};

const ACCENTS: Array<{ id: Accent; label: string }> = [
  { id: "en-IN", label: "English · Indian" },
  { id: "en-PH", label: "English · Filipino" },
  { id: "en-US", label: "English · American" },
  { id: "en-GB", label: "English · British" },
  { id: "ar-GULF", label: "العربية · خليجي" },
  { id: "ar-EG", label: "العربية · مصري" },
  { id: "ar-SY", label: "العربية · سوري" },
  { id: "ar-MA", label: "العربية · مغربي" },
  { id: "ar-DZ", label: "العربية · جزائري" },
];

const accentLabel = (accent: Accent) => ACCENTS.find((item) => item.id === accent)?.label || accent;

export default function NameSenseStudyInvitesPage() {
  const { allowed, checking } = useAdminAuth();
  const [accent, setAccent] = useState<Accent>("en-IN");
  const [maxTrials, setMaxTrials] = useState(40);
  const [expiresHours, setExpiresHours] = useState(72);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/namesense-benchmark/invites", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json() as { invites?: InviteRow[] };
    setInvites(Array.isArray(data.invites) ? data.invites : []);
  }, []);

  useEffect(() => { if (allowed) void refresh(); }, [allowed, refresh]);

  const createInvite = async () => {
    setCreating(true); setStatus(""); setNewLink(""); setCopied(false);
    try {
      const response = await fetch("/api/admin/namesense-benchmark/invites", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ accent, maxTrials, expiresHours }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; invitePath?: string };
      if (!response.ok || !data.invitePath) throw new Error(data.error || "تعذر إنشاء الدعوة");
      const link = new URL(data.invitePath, window.location.origin).toString();
      setNewLink(link); setStatus("تم إنشاء رابط جديد. الرمز الخام يظهر الآن فقط ولا يُخزن في قاعدة البيانات.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر إنشاء الدعوة");
    } finally { setCreating(false); }
  };

  const copyLink = async () => {
    if (!newLink) return;
    await navigator.clipboard.writeText(newLink);
    setCopied(true);
  };

  const revoke = async (inviteId: string) => {
    const response = await fetch("/api/admin/namesense-benchmark/invites", {
      method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (response.ok) { setStatus("تم إلغاء الدعوة"); await refresh(); }
  };

  const activeCount = useMemo(() => invites.filter((item) => !item.revoked && item.used_trials < item.max_trials && Date.parse(item.expires_at) > Date.now()).length, [invites]);

  if (checking || !allowed) return null;

  return <main className="invite-lab" dir="rtl">
    <header className="invite-top"><a href="/admin/namesense-benchmark">← مختبر NameSense</a><span>دعوات الدراسة البشرية</span></header>
    <section className="invite-hero"><div><small>Controlled recruitment</small><h1>أنشئ رابطًا واحدًا لكل متحدث</h1><p>كل دعوة مرتبطة بلهجة واحدة ومعرّف مجهول وسقف تجارب وانتهاء صلاحية. لا تمنح الدعوة أي وصول إداري.</p></div><div className="invite-stat"><b>{activeCount}</b><span>دعوات نشطة</span></div></section>

    <section className="invite-grid">
      <article className="invite-card">
        <h2>دعوة جديدة</h2>
        <label>اللهجة أو اللكنة<select value={accent} onChange={(event) => setAccent(event.target.value as Accent)}>{ACCENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="invite-two"><label>عدد الجولات<input type="number" min={10} max={60} value={maxTrials} onChange={(event) => setMaxTrials(Number(event.target.value))} /></label><label>الصلاحية بالساعات<input type="number" min={1} max={168} value={expiresHours} onChange={(event) => setExpiresHours(Number(event.target.value))} /></label></div>
        <button className="invite-primary" type="button" disabled={creating} onClick={() => void createInvite()}>{creating ? "ينشئ الرابط…" : "إنشاء رابط مشاركة"}</button>
        {status && <p className="invite-status">{status}</p>}
        {newLink && <div className="invite-link"><input readOnly value={newLink} dir="ltr" aria-label="رابط المشاركة الجديد" /><button type="button" onClick={() => void copyLink()}>{copied ? "تم النسخ" : "نسخ"}</button></div>}
        <p className="invite-note">الافتراضي 40 جولة، أي 20 إيجابية و20 سلبية تقريبًا لكل متحدث. لا ترسل نفس الرابط لأكثر من شخص.</p>
      </article>

      <article className="invite-card invite-policy"><h2>قواعد الجمع</h2><ul><li>دعوة منفصلة لكل متحدث.</li><li>اختر اللهجة حسب تعريف المتحدث لنفسه، لا حسب تخمينك.</li><li>لا تطلب اسمًا أو بريدًا أو رقمًا.</li><li>الصوت الخام لا يغادر جهاز المشارك.</li><li>النتائج لا تصبح “دقة معتمدة” قبل اكتمال شروط الـbenchmark.</li></ul></article>
    </section>

    <section className="invite-card invite-list"><div className="invite-list__head"><div><small>Recent invites</small><h2>آخر الدعوات</h2></div><button type="button" onClick={() => void refresh()}>تحديث</button></div>
      <div className="invite-table" role="table" aria-label="دعوات NameSense">
        <div className="invite-row invite-row--head" role="row"><span>المجموعة</span><span>التقدم</span><span>الانتهاء</span><span>الحالة</span><span /></div>
        {invites.length === 0 && <p className="invite-empty">لا توجد دعوات بعد.</p>}
        {invites.map((item) => {
          const expired = Date.parse(item.expires_at) <= Date.now();
          const done = item.used_trials >= item.max_trials;
          const active = !item.revoked && !expired && !done;
          return <div className="invite-row" role="row" key={item.invite_id}><span>{accentLabel(item.accent)}</span><span>{item.used_trials}/{item.max_trials}</span><span>{new Date(item.expires_at).toLocaleString("ar")}</span><span>{item.revoked ? "ملغاة" : done ? "مكتملة" : expired ? "منتهية" : "نشطة"}</span><span>{active && <button className="invite-danger" type="button" onClick={() => void revoke(item.invite_id)}>إلغاء</button>}</span></div>;
        })}
      </div>
    </section>
  </main>;
}
