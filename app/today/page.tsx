"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FeatureAccessGate from "../FeatureAccessGate";
import PersonalReminderEngine from "../PersonalReminderEngine";
import { readAcademicReminders, saveAcademicReminder, type AcademicReminder } from "../academicReminders";
import "../navixa.css";
import "./today.css";

type Task = { title: string; done: boolean; meta?: string };
type QuickAddKind = "task" | "appointment" | "focus";

const TASKS_KEY = "navixa-life-tasks";
const riyadhDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const arabicDate = (date: string) => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00+03:00`));
const todayLabel = () => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(new Date());

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [academicReminders, setAcademicReminders] = useState<AcademicReminder[]>([]);
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kind, setKind] = useState<QuickAddKind>("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(riyadhDate);
  const [time, setTime] = useState("18:00");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try { setTasks(JSON.parse(localStorage.getItem(TASKS_KEY) || "[]")); } catch { setTasks([]); }
    setAcademicReminders(readAcademicReminders());
    const refresh = () => setAcademicReminders(readAcademicReminders());
    window.addEventListener("navixa:academic-reminder", refresh);
    setReady(true);
    return () => window.removeEventListener("navixa:academic-reminder", refresh);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }, [tasks, ready]);

  const openQuickAdd = (nextKind: QuickAddKind = "task") => {
    setKind(nextKind);
    setTitle("");
    setDate(riyadhDate());
    setTime("18:00");
    setSheetOpen(true);
  };
  const pendingTasks = tasks.filter((task) => !task.done);
  const upcoming = useMemo(() => academicReminders.filter((item) => item.date >= riyadhDate()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3), [academicReminders]);
  const nextReminder = upcoming[0];
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "صباح الخير" : greetingHour < 18 ? "مساء الخير" : "مساء النور";

  const submitQuickAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim().slice(0, 120);
    if (kind !== "focus" && !cleanTitle) { setNotice("اكتب عنوانًا مختصرًا أولًا"); return; }
    if (kind === "task") {
      setTasks((current) => [...current, { title: cleanTitle, done: false, meta: `من يومي · ${arabicDate(date)}` }]);
      setNotice("أُضيفت المهمة إلى يومك");
    }
    if (kind === "appointment") {
      const reminder = saveAcademicReminder({ title: cleanTitle, date });
      setAcademicReminders((current) => [...current.filter((item) => item.id !== reminder.id), reminder]);
      setTasks((current) => [...current, { title: `موعد: ${cleanTitle}`, done: false, meta: `${arabicDate(date)} · ${time}` }]);
      setNotice("حُفظ الموعد كتذكير ومهمة قابلة للمتابعة");
    }
    if (kind === "focus") {
      const duration = Math.min(120, Math.max(5, Number(title) || 25));
      localStorage.setItem("navixa-focus-duration-minutes", String(duration));
      setNotice(`تم تجهيز جلسة تركيز ${duration} دقيقة`);
    }
    setSheetOpen(false);
  };

  return <main className="today-page" dir="rtl">
    <FeatureAccessGate feature="صفحة يومي والإضافة السريعة">
      <PersonalReminderEngine focusRunning={false} focusElapsedSeconds={0} onReminder={setNotice} />
      <header className="today-topbar">
        <Link href="/" className="today-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <em>SA</em></b><small>يفهم يومك</small></span></Link>
        <nav aria-label="تنقل صفحة يومي"><Link href="/">الرئيسية</Link><Link href="/portfolio">المنظومة</Link><Link className="today-alert-link" href="/#alerts">التنبيهات</Link><Link href="/account">حسابي</Link></nav>
      </header>

      <section className="today-hero" aria-labelledby="today-heading">
        <div><small>{todayLabel()} · يومك في لمحة</small><h1 id="today-heading">{greeting}، <strong>نرتب أهم شيء الآن.</strong></h1><p>ابدأ بأولوية واحدة، ثم أضف ما يستجد دون أن تضيع وسط القوائم.</p><div className="today-hero-actions"><button type="button" onClick={() => openQuickAdd("task")}>＋ إضافة سريعة</button><a href="#today-priorities">عرض الأولويات ↓</a></div></div>
        <aside className="today-next-card"><span>◷</span><div><small>أقرب تذكير</small><b>{nextReminder ? nextReminder.title : "لا يوجد موعد قريب"}</b><em>{nextReminder ? arabicDate(nextReminder.date) : "أضف موعدًا أو اختبارًا في ثوانٍ"}</em></div><button type="button" onClick={() => openQuickAdd("appointment")}>إضافة موعد</button></aside>
      </section>

      {notice && <p className="today-notice" role="status">✓ {notice}<button type="button" onClick={() => setNotice("")} aria-label="إخفاء">×</button></p>}

      <section className="today-quick-actions" aria-label="إضافة سريعة"><button type="button" onClick={() => openQuickAdd("task")}><span className="quick-icon green">✓</span><b>مهمة</b><small>أضف أول خطوة</small></button><button type="button" onClick={() => openQuickAdd("appointment")}><span className="quick-icon lavender">◷</span><b>موعد</b><small>اختبار أو اجتماع</small></button><button type="button" onClick={() => openQuickAdd("focus")}><span className="quick-icon navy">◎</span><b>تركيز</b><small>ابدأ بهدوء</small></button><Link href="/#alerts"><span className="quick-icon rose">♢</span><b>تذكير</b><small>اختر القناة</small></Link></section>

      <section className="today-content" id="today-priorities">
        <section className="today-priorities"><div className="today-section-head"><div><small>أولوياتك</small><h2>ما الذي يحتاج انتباهك اليوم؟</h2></div><button type="button" onClick={() => openQuickAdd("task")}>＋ مهمة</button></div>
          <div className="today-task-list">{pendingTasks.length ? pendingTasks.slice(0, 5).map((task, index) => <label key={`${task.title}-${index}`}><input type="checkbox" checked={task.done} onChange={() => setTasks((current) => current.map((item, itemIndex) => itemIndex === tasks.indexOf(task) ? { ...item, done: !item.done } : item))} /><span><b>{task.title}</b><small>{task.meta || "تحتاج تحديد وقت مناسب"}</small></span><i>أكمل</i></label>) : <div className="today-empty"><span>✦</span><b>يومك خفيف الآن</b><p>أضف مهمة واحدة واضحة لتبدأ بلا تشتت.</p><button type="button" onClick={() => openQuickAdd("task")}>إضافة أول مهمة</button></div>}</div>
        </section>
        <aside className="today-reminders"><div className="today-section-head"><div><small>مركز التذكيرات</small><h2>تنبيهاتك باختيارك</h2></div><Link href="/#alerts">إدارة ←</Link></div><p>داخل NAVIXA دائمًا، وإشعار الجهاز أو تيليجرام عند التفعيل الصريح فقط.</p><div className="reminder-channel-status"><span><i className="channel-dot active"/>داخل الموقع <b>مفعّل</b></span><span><i className="channel-dot"/>إشعار الجهاز <b>اختياري</b></span><span><i className="channel-dot telegram"/>Telegram <b>اربطه مرة</b></span></div><div className="today-upcoming"><small>المواعيد القادمة</small>{upcoming.length ? upcoming.map((item) => <article key={item.id}><span>◷</span><div><b>{item.title}</b><small>{arabicDate(item.date)} · تذكير قبل يوم</small></div></article>) : <p>لا توجد مواعيد محفوظة بعد.</p>}</div></aside>
      </section>

      <section className="today-focus-card"><div><small>مساحة تركيز</small><h2>ابدأ بـ25 دقيقة، ثم راجع يومك بهدوء.</h2><p>المدة تحفظ على جهازك، ويمكنك تغييرها من الإضافة السريعة.</p></div><Link href="/#focus">فتح جلسة التركيز ←</Link></section>

      <nav className="today-bottom-nav" aria-label="اختصارات الجوال"><Link href="/"><span>⌂</span><b>الرئيسية</b></Link><Link className="active" href="/today"><span>◷</span><b>يومي</b></Link><button type="button" onClick={() => openQuickAdd("task")} aria-label="إضافة سريعة"><span>＋</span><b>إضافة</b></button><Link href="/#alerts"><span>♢</span><b>التنبيهات</b></Link><Link href="/portfolio"><span>◌</span><b>المنظومة</b></Link><Link href="/account"><span>⌾</span><b>حسابي</b></Link></nav>

      {sheetOpen && <div className="quick-add-backdrop" onClick={() => setSheetOpen(false)}><section className="quick-add-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onClick={(event) => event.stopPropagation()}><button className="quick-add-close" type="button" onClick={() => setSheetOpen(false)} aria-label="إغلاق">×</button><small>إضافة سريعة</small><h2 id="quick-add-title">{kind === "task" ? "أضف مهمة واضحة" : kind === "appointment" ? "أضف موعدًا وتذكيرًا" : "جهّز جلسة تركيز"}</h2><div className="quick-add-types"><button type="button" className={kind === "task" ? "selected" : ""} onClick={() => setKind("task")}>✓ مهمة</button><button type="button" className={kind === "appointment" ? "selected" : ""} onClick={() => setKind("appointment")}>◷ موعد</button><button type="button" className={kind === "focus" ? "selected" : ""} onClick={() => setKind("focus")}>◎ تركيز</button></div><form onSubmit={submitQuickAdd}>{kind === "focus" ? <label>المدة بالدقائق<input autoFocus value={title} inputMode="numeric" onChange={(event) => setTitle(event.target.value)} placeholder="25" /></label> : <><label>{kind === "task" ? "ما المهمة؟" : "ما الموعد؟"}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "task" ? "مثال: مراجعة محاضرة اليوم" : "مثال: كويز مادة الإحصاء"} maxLength={120} /></label><div className="quick-add-datetime"><label>التاريخ<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>{kind === "appointment" && <label>الوقت<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>}</div></>}<button type="submit">{kind === "appointment" ? "حفظ الموعد والتذكير" : kind === "focus" ? "تجهيز جلسة التركيز" : "إضافة المهمة"}</button></form><p>{kind === "appointment" ? "سيظهر الموعد في يومي ويُضاف له تذكير قبل يوم. يمكنك إدارة قناة الوصول من مركز التنبيهات." : "تُحفظ هذه الإضافة على جهازك، ويمكنك تعديلها أو حذفها لاحقًا."}</p></section></div>}
    </FeatureAccessGate>
  </main>;
}
