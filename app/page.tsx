"use client";

import { useEffect, useState } from "react";
import "./navixa.css";

type Task={title:string;done:boolean};
const starters:Task[]=[{title:"مراجعة عرض المشروع",done:false},{title:"تأكيد موعد الفريق",done:true},{title:"إنهاء ملخص المحاضرة",done:false}];

export default function Home(){
  const [tasks,setTasks]=useState<Task[]>(starters);
  const [ready,setReady]=useState(false);
  const [seconds,setSeconds]=useState(25*60);
  const [running,setRunning]=useState(false);
  const [listening,setListening]=useState(false);
  const [screen,setScreen]=useState(false);
  const [toast,setToast]=useState("");
  const [modal,setModal]=useState<"tasks"|"ask"|null>(null);
  const notify=(message:string)=>{setToast(message);setTimeout(()=>setToast(""),2200)};
  useEffect(()=>{const saved=localStorage.getItem("navixa-life-tasks");if(saved)setTasks(JSON.parse(saved));setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-life-tasks",JSON.stringify(tasks))},[tasks,ready]);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);notify("أحسنت! انتهت جلسة التركيز");return 25*60}return s-1}),1000);return()=>clearInterval(timer)},[running]);
  const time=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

  return <main className="nx" dir="rtl">
    {toast&&<div className="nx-toast">✓ {toast}</div>}
    <aside className="nx-side">
      <a className="nx-brand" href="#top"><span>ن</span><div><b>NAVIXA</b><small>مساعدك اليومي</small></div></a>
      <nav>
        <a className="active" href="#top"><i>⌂</i> اليوم</a>
        <a href="#assistant"><i>✦</i> مساعدي</a>
        <button onClick={()=>setModal("tasks")}><i>✓</i> المهام <em>{tasks.filter(t=>!t.done).length}</em></button>
        <a href="#focus"><i>◎</i> التركيز</a>
        <a href="#automations"><i>⌘</i> الأتمتة</a>
      </nav>
      <a className="nx-admin" href="/admin">⚙ لوحة الإدارة <span>←</span></a>
      <div className="nx-user"><span>م</span><div><b>محمد</b><small>الرياض، السعودية</small></div><i>•••</i></div>
    </aside>

    <section className="nx-page" id="top">
      <header className="nx-head"><a className="mobile-brand" href="#top">N</a><div><small>السبت، 1 أغسطس · الرياض</small><h1>هلا محمد، وش ودّك تنجز اليوم؟</h1></div><div><a href="/admin">لوحة الإدارة</a><button aria-label="التنبيهات" onClick={()=>notify("ما عندك تنبيهات عاجلة")}>♢<i/></button><span className="nx-avatar">م</span></div></header>

      <section className="nx-hero showcase">
        <div className="arch one"/><div className="arch two"/><div className="saudi-pattern"/>
        <div className="lavender lavender-a">⚘<br/>⚘<br/>⚘</div><div className="lavender lavender-b">⚘ ⚘</div>
        <aside className="day-board"><div className="board-title"><b>اليوم</b><span>⌄</span></div><article><i>▣</i><p><b>دراسة</b><small>ملخص الكيمياء العضوية</small></p></article><article><i>▰</i><p><b>عمل</b><small>تقرير أداء المشروع</small></p></article><article><i>♙</i><p><b>اجتماعات</b><small>مراجعة خطة الربع</small></p></article><article><i>✓</i><p><b>مهام</b><small>{tasks.filter(t=>!t.done).length} مهام متبقية</small></p></article></aside>
        <div className="hero-center"><div className="navixa-mark"><i/><i/></div><h2>NAVIXA</h2><h3>ذكاء يفهم يومك</h3><button className="main-ask" onClick={()=>setModal("ask")}><span>✦</span> كيف يمكنني مساعدتك اليوم؟ <i>↑</i></button><div className="quick-prompts"><button onClick={()=>setModal("ask")}>تخطيط الأسبوع ▦</button><button onClick={()=>setModal("tasks")}>تنظيم المهام ✓</button><button onClick={()=>setModal("ask")}>إعداد عرض ▣</button><button onClick={()=>setModal("ask")}>تلخيص المستندات ▤</button></div></div>
        <div className="smart-note"><small>مساعدك الذكي</small><p>لخّص لي نقاط الاجتماع<br/>واقترح الإجراءات التالية</p><button onClick={()=>setModal("ask")}>✦</button></div>
        <button className="focus-card" onClick={()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"})}><b>تركيز</b><span>{time}</span><small>جلسة تركيز</small><i/></button>
      </section>

      <section className="daily-strip"><div><small>إنجاز اليوم</small><b>72%</b><span><i style={{width:"72%"}}/></span></div><div><small>وقت التركيز</small><b>2س 15د</b><em>↑ 24 دقيقة</em></div><div><small>المهام المكتملة</small><b>{tasks.filter(t=>t.done).length} / {tasks.length}</b><em>ممتاز، كمّل</em></div><div><small>موعدك القادم</small><b>09:30</b><em>بعد 35 دقيقة</em></div></section>

      <section className="nx-section" id="assistant"><div className="section-head"><div><small>مساعدك الذكي</small><h2>كل ما تحتاجه ليوم أوضح</h2><p>أدوات فعلية تساعدك في الدراسة والعمل والحياة اليومية.</p></div><button onClick={()=>setModal("ask")}>اسأل المساعد ←</button></div>
        <div className="feature-grid">
          <article className="wide lavender"><div className="feature-icon">◉</div><div><small>في الاجتماعات والمحاضرات</small><h3>ينتبه عند سماع اسمك</h3><p>فعّل الاستماع، وNAVIXA ينبهك إذا ذُكر اسمك حتى ما يفوتك شيء مهم.</p><button onClick={()=>{setListening(!listening);notify(!listening?"تم تشغيل متابعة الاسم":"تم إيقاف متابعة الاسم")}}>{listening?"إيقاف الاستماع":"تشغيل الاستماع"}</button></div><span className={`status ${listening?"live":""}`}>{listening?"● يستمع الآن":"○ متوقف"}</span></article>
          <article className="wide green"><div className="feature-icon">▣</div><div><small>تركيز وخصوصية</small><h3>متابعة نشاط الشاشة</h3><p>يعطيك تنبيهًا عند التشتت أو مغادرة الشاشة، والتحكم بيدك دائمًا.</p><button onClick={()=>{setScreen(!screen);notify(!screen?"بدأت جلسة متابعة الشاشة":"توقفت متابعة الشاشة")}}>{screen?"إنهاء المتابعة":"ابدأ المتابعة"}</button></div><span className={`status ${screen?"live":""}`}>{screen?"● الجلسة نشطة":"○ غير مفعّل"}</span></article>
          <article><div className="feature-icon">▦</div><small>تنظيم</small><h3>مهام ومواعيد</h3><p>رتّب يومك وتابع إنجازك بدون تعقيد.</p><button onClick={()=>setModal("tasks")}>فتح المهام ←</button></article>
          <article><div className="feature-icon">▤</div><small>ذكاء عملي</small><h3>تلخيص سريع</h3><p>حوّل النصوص والاجتماعات إلى نقاط واضحة.</p><button onClick={()=>setModal("ask")}>ابدأ التلخيص ←</button></article>
          <article><div className="feature-icon">⌁</div><small>في مكان واحد</small><h3>روابطك المهمة</h3><p>ثبّت أدوات الدراسة والعمل التي تستخدمها يوميًا.</p><a href="https://calendar.google.com" target="_blank">فتح التقويم ↗</a></article>
        </div>
      </section>

      <section className="focus-zone" id="focus"><div><small>جلسة تركيز</small><h2>خذ وقتك. خلّ الباقي علينا.</h2><p>مؤقت بسيط يساعدك تنجز بعيدًا عن التشتت.</p><div className="focus-actions"><button onClick={()=>setRunning(!running)}>{running?"إيقاف مؤقت":"ابدأ 25 دقيقة"}</button><button className="ghost" onClick={()=>{setRunning(false);setSeconds(25*60)}}>إعادة</button></div></div><div className={`timer ${running?"running":""}`}><span>{time}</span><small>{running?"أنت الآن في وضع التركيز":"جاهز متى ما كنت"}</small></div><div className="lavender-stem">✦</div></section>

      <section className="nx-section automation" id="automations"><div className="section-head"><div><small>الأتمتة</small><h2>NAVIXA يختصر الخطوات عنك</h2><p>قواعد بسيطة تتكرر تلقائيًا في وقتها.</p></div><button onClick={()=>notify("تم تجهيز نموذج أتمتة جديدة")}>＋ أتمتة جديدة</button></div><div className="automation-list">{[["☀","بداية اليوم","كل صباح · 7:00","ملخص المهام والطقس والمواعيد"],["◉","وقت الاجتماع","عند بدء الاجتماع","تشغيل متابعة الاسم وتدوين النقاط"],["◎","وضع التركيز","أيام العمل · 6:30 م","كتم التنبيهات وبدء مؤقت التركيز"]].map((x,i)=><article key={x[1]}><span>{x[0]}</span><div><b>{x[1]}</b><small>{x[2]}</small></div><p>{x[3]}</p><label><input aria-label={`تفعيل ${x[1]}`} type="checkbox" defaultChecked={i!==2}/><i/></label></article>)}</div></section>

      <footer><div className="nx-brand"><span>ن</span><div><b>NAVIXA</b><small>ذكاء سعودي يفهم يومك</small></div></div><p>مصمم لحياة أكثر ترتيبًا، من الرياض إلى كل مكان.</p><span>© 2026 NAVIXA</span></footer>
    </section>

    {modal&&<div className="nx-modal-back" onClick={()=>setModal(null)}><section className="nx-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button>{modal==="tasks"?<><small>مهامي</small><h2>خلّ يومك واضح</h2><div className="task-list">{tasks.map((t,i)=><label key={`${t.title}-${i}`}><input type="checkbox" checked={t.done} onChange={()=>setTasks(tasks.map((x,j)=>j===i?{...x,done:!x.done}:x))}/><span className={t.done?"done":""}>{t.title}</span><button onClick={()=>setTasks(tasks.filter((_,j)=>j!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);setTasks([...tasks,{title:String(data.get("task")),done:false}]);e.currentTarget.reset()}}><input name="task" required placeholder="أضف مهمة جديدة..."/><button>إضافة</button></form></>:<><small>مساعد NAVIXA</small><h2>وش أقدر أسوي لك؟</h2><div className="suggestions"><button onClick={()=>notify("جهزت لك خطة يوم متوازنة")}>رتّب يومي</button><button onClick={()=>notify("أرسل النص وسألخصه لك")}>لخّص لي</button><button onClick={()=>notify("بدأ تجهيز قائمة الأولويات")}>حدّد أولوياتي</button></div><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلبك إلى NAVIXA");setModal(null)}}><input required placeholder="اكتب طلبك هنا..."/><button>إرسال</button></form></>}</section></div>}
  </main>
}
