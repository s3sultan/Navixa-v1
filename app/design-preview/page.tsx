"use client";

import { useMemo, useState } from "react";
import "./preview.css";

type Mode = "listen" | "watch" | "ai";

type IconName =
  | "headphones"
  | "eye"
  | "spark"
  | "check"
  | "clock"
  | "calendar"
  | "bolt"
  | "layers"
  | "child"
  | "book"
  | "fitness";

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "headphones") return <svg {...common}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 14v3a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2Z"/><path d="M20 14v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2Z"/></svg>;
  if (name === "eye") return <svg {...common}><path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "spark") return <svg {...common}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z"/></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (name === "bolt") return <svg {...common}><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></svg>;
  if (name === "child") return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M6.5 20c.8-4 2.7-6 5.5-6s4.7 2 5.5 6"/></svg>;
  if (name === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></svg>;
  return <svg {...common}><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>;
}

const modeCopy = {
  listen: {
    eyebrow: "استماع حي",
    title: "المحاضرة تُفهم أثناء حدوثها",
    text: "يقسّم NAVIXA الجلسة إلى أجزاء خفيفة، يلخّص كل 30 دقيقة، ثم يبني خلاصة نهائية مع القرارات والمهام.",
  },
  watch: {
    eyebrow: "مراقبة ذكية",
    title: "راقب الجزء المهم واترك الباقي لنا",
    text: "اختر الشاشة كاملة أو منطقة محددة، وعند ظهور سؤال أو تصويت أو تغير مهم يصلك التنبيه مباشرة.",
  },
  ai: {
    eyebrow: "ذكاء NAVIXA",
    title: "من الكلام إلى خطوة قابلة للتنفيذ",
    text: "يحوّل السياق إلى مهام ومواعيد وقرارات، ثم يقترح الإجراء التالي بدل أن يترك لك ملخصًا جامدًا.",
  },
};

const chunks = [
  { time: "00–30", title: "مقدمة المحاضرة", status: "تم", active: false },
  { time: "30–60", title: "الموضوع الرئيسي", status: "تم", active: false },
  { time: "60–90", title: "أمثلة وتطبيق", status: "يُلخّص الآن", active: true },
  { time: "90–120", title: "بانتظار المحتوى", status: "التالي", active: false },
];

const extracted = [
  { icon: "calendar" as const, label: "موعد", value: "كويز الأحد 7:30 م" },
  { icon: "check" as const, label: "مهمة", value: "مراجعة الفصل الرابع" },
  { icon: "clock" as const, label: "تذكير", value: "قبل الكويز بـ 24 ساعة" },
];

const projects = [
  { icon: "child" as const, name: "NAVIXA Kids", text: "تعلم آمن وواضح" },
  { icon: "book" as const, name: "English Learning", text: "تعلم بخطوات قصيرة" },
  { icon: "fitness" as const, name: "NAVIXA Fitness", text: "بيت، نادي، مكتب" },
];

export default function DesignPreviewPage() {
  const [mode, setMode] = useState<Mode>("listen");
  const [monitorOn, setMonitorOn] = useState(true);
  const [promptMode, setPromptMode] = useState<"brief" | "tasks" | "decisions">("brief");

  const promptResult = useMemo(() => {
    if (promptMode === "tasks") return "3 مهام واضحة، مرتبة حسب الأولوية، مع موعد مقترح لكل مهمة.";
    if (promptMode === "decisions") return "قراران مهمان تم استخراجهما مع سبب مختصر وما يجب فعله بعدهما.";
    return "خلاصة مركزة للجلسة بدون تكرار، تجمع الأجزاء الأربعة في سياق واحد.";
  }, [promptMode]);

  const copy = modeCopy[mode];

  return (
    <main className="preview-app" dir="rtl">
      <div className="preview-glow glow-a" aria-hidden="true" />
      <div className="preview-glow glow-b" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="NAVIXA">
          <span className="brand-mark">N</span>
          <span className="brand-copy"><b>NAVIXA</b><small>يفهم يومك</small></span>
        </a>
        <div className="topbar-center">
          <span className="status-dot" />
          <span>نسخة تجريبية آمنة</span>
        </div>
        <div className="topbar-actions">
          <span className="trial-pill">STAGING</span>
          <button type="button" className="avatar" aria-label="حساب تجريبي">س</button>
        </div>
      </header>

      <div className="app-frame" id="workspace">
        <aside className="sidebar">
          <div className="side-group">
            <span className="side-label">المساحة</span>
            <button className="side-item active"><Icon name="layers"/><span>اليوم</span></button>
            <button className="side-item"><Icon name="bolt"/><span>عزم</span></button>
          </div>
          <div className="side-group">
            <span className="side-label">القدرات</span>
            <button className={mode === "listen" ? "side-item active" : "side-item"} onClick={() => setMode("listen")}><Icon name="headphones"/><span>استمع ولخّص</span></button>
            <button className={mode === "watch" ? "side-item active" : "side-item"} onClick={() => setMode("watch")}><Icon name="eye"/><span>راقب ونبّهني</span></button>
            <button className={mode === "ai" ? "side-item active" : "side-item"} onClick={() => setMode("ai")}><Icon name="spark"/><span>ذكاء NAVIXA</span></button>
          </div>
          <div className="side-foot">
            <span>همة</span>
            <strong>المنظومة كاملة</strong>
            <small>تجريبي فقط</small>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-head">
            <div>
              <span className="eyebrow">{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.text}</p>
            </div>
            <div className="mode-switcher" role="tablist" aria-label="تبديل المعاينة">
              <button className={mode === "listen" ? "active" : ""} onClick={() => setMode("listen")}><Icon name="headphones"/>استماع</button>
              <button className={mode === "watch" ? "active" : ""} onClick={() => setMode("watch")}><Icon name="eye"/>مراقبة</button>
              <button className={mode === "ai" ? "active" : ""} onClick={() => setMode("ai")}><Icon name="spark"/>ذكاء</button>
            </div>
          </div>

          <div className="dashboard-grid">
            <article className="main-card session-card">
              <div className="card-head">
                <div><span className="live-badge"><i/> مباشر</span><h2>جلسة ENG05</h2></div>
                <span className="session-time">01:17:42</span>
              </div>

              <div className="wave" aria-label="مؤشر صوت تجريبي">
                {Array.from({ length: 34 }).map((_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 42)}%` }} />)}
              </div>

              <div className="chunk-list">
                {chunks.map((chunk) => (
                  <div className={chunk.active ? "chunk active" : "chunk"} key={chunk.time}>
                    <span className="chunk-time">{chunk.time}</span>
                    <div><strong>{chunk.title}</strong><small>{chunk.status}</small></div>
                    <span className="chunk-state">{chunk.active ? <span className="spinner"/> : <Icon name="check" size={17}/>}</span>
                  </div>
                ))}
              </div>

              <div className="merge-bar">
                <div><Icon name="spark"/><span><b>الملخص النهائي</b><small>سيُجمع تلقائيًا من الأجزاء عند نهاية الجلسة</small></span></div>
                <strong>68%</strong>
              </div>
            </article>

            <div className="stack-column">
              <article className="mini-card watch-card">
                <div className="mini-head"><div><Icon name="eye"/><strong>مراقبة الشاشة</strong></div><button type="button" className={monitorOn ? "toggle on" : "toggle"} onClick={() => setMonitorOn((v) => !v)} aria-pressed={monitorOn}><i/></button></div>
                <div className={monitorOn ? "screen-preview scanning" : "screen-preview"}>
                  <span className="screen-toolbar"/><span className="screen-line wide"/><span className="screen-line"/><span className="screen-box"/>
                  {monitorOn && <div className="scan-zone"><span>منطقة المراقبة</span></div>}
                </div>
                <p>{monitorOn ? "يراقب منطقة محددة وينبّهك عند ظهور سؤال أو تغيير مهم." : "المراقبة متوقفة. فعّلها لتجربة الحالة الحية."}</p>
              </article>

              <article className="mini-card extracted-card">
                <div className="mini-head"><div><Icon name="bolt"/><strong>استخرجنا لك</strong></div><span className="count-badge">3</span></div>
                <div className="extracted-list">
                  {extracted.map((item) => <div className="extracted-item" key={item.value}><span className="small-icon"><Icon name={item.icon} size={17}/></span><div><small>{item.label}</small><strong>{item.value}</strong></div></div>)}
                </div>
              </article>
            </div>
          </div>

          <section className="prompt-studio">
            <div className="studio-copy">
              <span className="eyebrow">NAVIXA Prompt Studio</span>
              <h2>ذكاء يعمل بقواعدنا نحن</h2>
              <p>بدل Prompt واحد ضخم، نستخدم أوامر صغيرة متخصصة ثم نجمع نتائجها حسب سياق الجلسة.</p>
              <div className="prompt-tabs">
                <button className={promptMode === "brief" ? "active" : ""} onClick={() => setPromptMode("brief")}>ملخص ذكي</button>
                <button className={promptMode === "tasks" ? "active" : ""} onClick={() => setPromptMode("tasks")}>استخراج المهام</button>
                <button className={promptMode === "decisions" ? "active" : ""} onClick={() => setPromptMode("decisions")}>القرارات</button>
              </div>
            </div>
            <div className="prompt-result">
              <span className="result-label"><Icon name="spark" size={17}/> النتيجة المتوقعة</span>
              <p>{promptResult}</p>
              <div className="result-meta"><span>مختصر</span><span>بدون تكرار</span><span>قابل للتنفيذ</span></div>
            </div>
          </section>

          <section className="ecosystem-section">
            <div className="section-title"><div><span className="eyebrow">منظومة واحدة</span><h2>نفس اللغة البصرية لكل مشاريعنا</h2></div><p>المكونات تتغير حسب المشروع، لكن التنظيم والحركة والوضوح يبقون ثابتين.</p></div>
            <div className="project-grid">
              {projects.map((project) => <article className="project-card" key={project.name}><span className="project-icon"><Icon name={project.icon}/></span><div><strong>{project.name}</strong><small>{project.text}</small></div><span className="arrow">←</span></article>)}
            </div>
          </section>

          <footer className="preview-footer"><span>هذه الصفحة تجريبية فقط ولم تغيّر الموقع الرسمي.</span><strong>NAVIXA Preview Lab</strong></footer>
        </section>
      </div>
    </main>
  );
}
