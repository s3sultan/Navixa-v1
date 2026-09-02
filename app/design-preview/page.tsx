"use client";

import { useMemo, useState } from "react";
import "./preview.css";

type Mode = "listen" | "watch" | "ai";
type LabMode = "build" | "debug" | "security" | "test" | "learn";

const labModes: { id: LabMode; title: string; scope: string }[] = [
  { id: "build", title: "بناء ميزة", scope: "خطة → تنفيذ → تحقق" },
  { id: "debug", title: "حل مشكلة", scope: "دليل → سبب → إصلاح" },
  { id: "security", title: "فحص أمني", scope: "سطح الهجوم → خطورة → معالجة" },
  { id: "test", title: "اختبارات", scope: "حالات → حدود → نتيجة" },
  { id: "learn", title: "تعلم", scope: "شرح → مثال → سؤال" },
];

const modeCopy = {
  listen: { eyebrow: "استماع حي", title: "المحاضرة تُفهم أثناء حدوثها", text: "يلخّص كل 30 دقيقة، ثم يجمع الخلاصة النهائية ويستخرج القرارات والمهام." },
  watch: { eyebrow: "مراقبة ذكية", title: "راقب الجزء المهم فقط", text: "منطقة محددة من الشاشة، وتنبيه عند ظهور سؤال أو تصويت أو تغير يستحق انتباهك." },
  ai: { eyebrow: "ذكاء NAVIXA", title: "من السياق إلى خطوة قابلة للتنفيذ", text: "يفصل الفهم عن التنفيذ والتحقق، فلا يعتمد على التخمين أو إجابة واحدة ضخمة." },
};

export default function DesignPreviewPage() {
  const [mode, setMode] = useState<Mode>("listen");
  const [monitorOn, setMonitorOn] = useState(true);
  const [labMode, setLabMode] = useState<LabMode>("build");
  const lab = labModes.find((x) => x.id === labMode)!;
  const result = useMemo(() => ({
    build: "يفهم المطلوب، يحدد الملفات المتأثرة، ينفذ أقل تغيير ممكن، ثم يختبر قبل اعتبار المهمة منتهية.",
    debug: "يجمع الدليل أولًا، يعزل السبب الحقيقي، يصلح السبب لا العرض، ثم يعيد الاختبار لمنع رجوع المشكلة.",
    security: "يراجع الصلاحيات والمدخلات والأسرار ومسارات الإدارة، ثم يرتب المخاطر حسب الأثر وإمكانية الاستغلال.",
    test: "يبني حالات نجاح وفشل وحدود، ويتأكد أن التغيير لم يكسر وظيفة موجودة قبل النشر.",
    learn: "يشرح بمستوى المستخدم، يعطي مثالًا صغيرًا، ثم سؤالًا واحدًا للتأكد من الفهم قبل الانتقال.",
  }[labMode]), [labMode]);

  return <main className="preview-app" dir="rtl">
    <header className="topbar"><div className="brand"><span className="brand-mark">N</span><span className="brand-copy"><b>NAVIXA</b><small>يفهم يومك</small></span></div><div className="topbar-center"><span className="status-dot"/>التجريبي فقط</div><div className="topbar-actions"><span className="trial-pill">STAGING</span></div></header>
    <div className="app-frame">
      <aside className="sidebar"><div className="side-group"><span className="side-label">القدرات</span>{([['listen','استمع ولخّص'],['watch','راقب ونبّهني'],['ai','ذكاء NAVIXA']] as [Mode,string][]).map(([id,title])=><button key={id} className={mode===id?'side-item active':'side-item'} onClick={()=>setMode(id)}>{title}</button>)}</div><div className="side-foot"><span>همة</span><strong>منظومة NAVIXA</strong><small>لا تغيير على الأساسي</small></div></aside>
      <section className="workspace">
        <div className="workspace-head"><div><span className="eyebrow">{modeCopy[mode].eyebrow}</span><h1>{modeCopy[mode].title}</h1><p>{modeCopy[mode].text}</p></div><div className="mode-switcher">{(['listen','watch','ai'] as Mode[]).map(x=><button key={x} className={mode===x?'active':''} onClick={()=>setMode(x)}>{x==='listen'?'استماع':x==='watch'?'مراقبة':'ذكاء'}</button>)}</div></div>
        <div className="dashboard-grid">
          <article className="main-card session-card"><div className="card-head"><div><span className="live-badge"><i/> مباشر</span><h2>جلسة ENG05</h2></div><span className="session-time">01:17:42</span></div><div className="wave">{Array.from({length:34}).map((_,i)=><i key={i} style={{height:`${18+((i*17)%42)}%`}}/>)}</div><div className="chunk-list">{[['00–30','مقدمة المحاضرة','تم'],['30–60','الموضوع الرئيسي','تم'],['60–90','أمثلة وتطبيق','يُلخّص الآن'],['90–120','بانتظار المحتوى','التالي']].map((c,i)=><div className={i===2?'chunk active':'chunk'} key={c[0]}><span className="chunk-time">{c[0]}</span><div><strong>{c[1]}</strong><small>{c[2]}</small></div><span className="chunk-state">{i<2?'✓':i===2?<span className="spinner"/>:'·'}</span></div>)}</div><div className="merge-bar"><div><span><b>الملخص النهائي</b><small>دمج تلقائي للأجزاء + قرارات + مهام</small></span></div><strong>68%</strong></div></article>
          <div className="stack-column"><article className="mini-card watch-card"><div className="mini-head"><strong>مراقبة الشاشة</strong><button className={monitorOn?'toggle on':'toggle'} onClick={()=>setMonitorOn(v=>!v)}><i/></button></div><div className={monitorOn?'screen-preview scanning':'screen-preview'}><span className="screen-toolbar"/><span className="screen-line wide"/><span className="screen-line"/><span className="screen-box"/>{monitorOn&&<div className="scan-zone"><span>منطقة المراقبة</span></div>}</div><p>{monitorOn?'جاهز للتنبيه عند تغير المنطقة المحددة.':'المراقبة متوقفة.'}</p></article><article className="mini-card extracted-card"><div className="mini-head"><strong>استخرجنا لك</strong><span className="count-badge">3</span></div><div className="extracted-list">{[['موعد','كويز الأحد 7:30 م'],['مهمة','مراجعة الفصل الرابع'],['تذكير','قبل الكويز بـ 24 ساعة']].map(x=><div className="extracted-item" key={x[1]}><div><small>{x[0]}</small><strong>{x[1]}</strong></div></div>)}</div></article></div>
        </div>
        <section className="prompt-studio"><div className="studio-copy"><span className="eyebrow">NAVIXA Intelligence Lab</span><h2>أوامرنا نحن، وليست نسخة من أحد</h2><p>حوّلنا الأفكار المفيدة إلى نظام داخلي مستقل: لا تخمين، لا تنفيذ قبل فهم السياق، والتحقق جزء من النتيجة.</p><div className="prompt-tabs">{labModes.map(x=><button key={x.id} className={labMode===x.id?'active':''} onClick={()=>setLabMode(x.id)}>{x.title}</button>)}</div></div><div className="prompt-result"><span>المسار الحالي</span><strong>{lab.title}</strong><small>{lab.scope}</small><p>{result}</p><div className="result-checks"><span>✓ فهم السياق</span><span>✓ أقل تغيير</span><span>✓ تحقق قبل الإنهاء</span></div></div></section>
        <section className="ecosystem-preview"><div className="ecosystem-title"><span className="eyebrow">توزيع الأفكار</span><h2>نفس المحرك، سلوك مختلف لكل مشروع</h2></div><div className="project-grid">{[['NAVIXA','اجتماعات، استماع، مهام وقرارات'],['Kids','شرح آمن قصير + تحقق مناسب للعمر'],['English Learning','شرح → مثال → سؤال واحد'],['Fitness','خطة واضحة + بدائل حسب المكان']].map(x=><article className="project-card" key={x[0]}><strong>{x[0]}</strong><span>{x[1]}</span><b>←</b></article>)}</div></section>
      </section>
    </div>
  </main>;
}
