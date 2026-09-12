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
type CreatedInvite = {
  inviteId: string;
  accent: Accent;
  maxTrials: number;
  expiresAt: string;
  invitePath: string;
  link: string;
};

const TARGET_SPEAKERS_PER_ACCENT = 25;
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
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export default function NameSenseStudyInvitesPage() {
  const { allowed, checking } = useAdminAuth();
  const [accent, setAccent] = useState<Accent>("en-IN");
  const [maxTrials, setMaxTrials] = useState(40);
  const [expiresHours, setExpiresHours] = useState(72);
  const [participantCount, setParticipantCount] = useState(TARGET_SPEAKERS_PER_ACCENT);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [newLinks, setNewLinks] = useState<CreatedInvite[]>([]);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/namesense-benchmark/invites", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json() as { invites?: InviteRow[] };
    setInvites(Array.isArray(data.invites) ? data.invites : []);
  }, []);

  useEffect(() => { if (allowed) void refresh(); }, [allowed, refresh]);

  const createInvite = async () => {
    setCreating(true); setStatus(""); setNewLinks([]); setCopied(false);
    try {
      const response = await fetch("/api/admin/namesense-benchmark/invites", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ accent, maxTrials, expiresHours, count: participantCount }),
      });
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        invitePath?: string;
        inviteId?: string;
        expiresAt?: string;
        invites?: Array<Omit<CreatedInvite, "link">>;
      };
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الدعوات");
      const rawInvites = Array.isArray(data.invites) && data.invites.length > 0
        ? data.invites
        : data.invitePath
          ? [{ inviteId: data.inviteId || "", accent, maxTrials, expiresAt: data.expiresAt || "", invitePath: data.invitePath }]
          : [];
      if (rawInvites.length === 0) throw new Error("لم يرجع الخادم روابط الدفعة");
      const links = rawInvites.map((item) => ({ ...item, link: new URL(item.invitePath, window.location.origin).toString() }));
      setNewLinks(links);
      setStatus(`تم إنشاء ${links.length} رابطًا منفصلًا. حمّل CSV أو انسخ الروابط الآن؛ الرموز الخام لن تظهر لاحقًا.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر إنشاء الدعوات");
    } finally { setCreating(false); }
  };

  const copyLinks = async () => {
    if (newLinks.length === 0) return;
    await navigator.clipboard.writeText(newLinks.map((item) => item.link).join("\n"));
    setCopied(true);
  };

  const downloadCsv = () => {
    if (newLinks.length === 0) return;
    const header = ["accent", "invite_id", "max_trials", "expires_at", "link"];
    const rows = newLinks.map((item) => [item.accent, item.inviteId, item.maxTrials, item.expiresAt, item.link]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `namesense-${accent}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const revoke = async (inviteId: string) => {
    const response = await fetch("/api/admin/namesense-benchmark/invites", {
      method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (response.ok) { setStatus("تم إلغاء الدعوة"); await refresh(); }
  };

  const activeCount = useMemo(() => invites.filter((item) => !item.revoked && item.used_trials < item.max_trials && Date.parse(item.expires_at) > Date.now()).length, [invites]);
  const recruitment = useMemo(() => ACCENTS.map((item) => {
    const cohort = invites.filter((invite) => invite.accent === item.id && !invite.revoked);
    const started = cohort.filter((invite) => invite.used_trials > 0).length;
    const completed = cohort.filter((invite) => invite.used_trials >= invite.max_trials).length;
    return { ...item, created: cohort.length, started, completed };
  }), [invites]);
  const completedTotal = recruitment.reduce((sum, item) => sum + Math.min(item.completed, TARGET_SPEAKERS_PER_ACCENT), 0);
  const targetTotal = ACCENTS.length * TARGET_SPEAKERS_PER_ACCENT;

  if (checking || !allowed) return null;

  return <main className="invite-lab" dir="rtl">
    <header className="invite-top"><a href="/admin/namesense-benchmark">← مختبر NameSense</a><span>دعوات الدراسة البشرية</span></header>
    <section className="invite-hero"><div><small>Controlled recruitment</small><h1>أطلق جمع الأصوات على دفعات محكومة</h1><p>الحد الأدنى العلمي 25 متحدثًا لكل مجموعة. كل شخص يأخذ رابطًا مستقلًا، ولا يُخزن رمز الدعوة الخام في قاعدة البيانات.</p></div><div className="invite-stat"><b>{completedTotal}/{targetTotal}</b><span>أكملوا 40 جولة</span></div></section>

    <section className="invite-grid">
      <article className="invite-card">
        <h2>دفعة دعوات جديدة</h2>
        <label>اللهجة أو اللكنة<select value={accent} onChange={(event) => setAccent(event.target.value as Accent)}>{ACCENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="invite-three">
          <label>عدد المشاركين<input type="number" min={1} max={25} value={participantCount} onChange={(event) => setParticipantCount(Number(event.target.value))} /></label>
          <label>الجولات لكل شخص<input type="number" min={10} max={60} value={maxTrials} onChange={(event) => setMaxTrials(Number(event.target.value))} /></label>
          <label>الصلاحية بالساعات<input type="number" min={1} max={168} value={expiresHours} onChange={(event) => setExpiresHours(Number(event.target.value))} /></label>
        </div>
        <button className="invite-primary" type="button" disabled={creating} onClick={() => void createInvite()}>{creating ? "ينشئ الدفعة…" : `إنشاء ${participantCount || 0} رابط مشاركة`}</button>
        {status && <p className="invite-status">{status}</p>}
        {newLinks.length > 0 && <div className="invite-batch-result">
          <div className="invite-batch-actions"><button type="button" onClick={() => void copyLinks()}>{copied ? "تم نسخ الكل" : "نسخ كل الروابط"}</button><button type="button" onClick={downloadCsv}>تنزيل CSV الآن</button></div>
          <p><b>{newLinks.length}</b> رابطًا جاهزًا لـ {accentLabel(accent)}. لا تغادر الصفحة قبل حفظها.</p>
          <div className="invite-preview" dir="ltr">{newLinks.slice(0, 3).map((item) => <code key={item.inviteId}>{item.link}</code>)}{newLinks.length > 3 && <small>+ {newLinks.length - 3} روابط أخرى داخل CSV</small>}</div>
        </div>}
        <p className="invite-note">الإعداد الموصى به للاعتماد: 25 مشاركًا × 40 جولة = 1000 تجربة لكل لهجة، موزعة تلقائيًا تقريبًا إلى 500 hit و500 miss. لا ترسل نفس الرابط لأكثر من شخص.</p>
      </article>

      <article className="invite-card invite-policy"><h2>قواعد الجمع</h2><ul><li>دعوة منفصلة لكل متحدث.</li><li>اختر اللهجة حسب تعريف المتحدث لنفسه، لا حسب تخمينك.</li><li>وزّع الأجهزة والبيئات، ولا تجمع الجميع من جهاز أو مكان واحد.</li><li>لا تطلب اسمًا أو بريدًا أو رقمًا.</li><li>الصوت الخام لا يغادر جهاز المشارك.</li><li>عداد التجنيد ليس دقة معتمدة؛ الحكم النهائي للـscorer فقط.</li></ul></article>
    </section>

    <section className="invite-card invite-recruitment"><div className="invite-list__head"><div><small>Recruitment matrix</small><h2>تغطية المجموعات التسع</h2></div><span>{activeCount} دعوة نشطة</span></div>
      <div className="recruitment-grid">{recruitment.map((item) => {
        const progress = Math.min(100, Math.round((item.completed / TARGET_SPEAKERS_PER_ACCENT) * 100));
        return <article className="recruitment-item" key={item.id}><div><b>{item.label}</b><span>{item.completed}/{TARGET_SPEAKERS_PER_ACCENT} مكتمل · {item.started} بدأ · {item.created} أُنشئ</span></div><div className="recruitment-bar" aria-label={`${progress}%`}><span style={{ width: `${progress}%` }} /></div></article>;
      })}</div>
      <p className="invite-note">هذه شاشة تجنيد وتشغيل فقط. أهلية العينات، توازن الأجهزة/المتصفحات/الضوضاء، وحدود Wilson والدقة تُحسب لاحقًا في بوابة benchmark الصارمة.</p>
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
