"use client";

import { useEffect, useState } from "react";
import "./interactions.css";

const areas = [
  { name: "الحقل الشرقي", plants: "طماطم · ريحان", moisture: 62, next: "ري تلقائي 6:30 م", icon: "🌿", tone: "mint" },
  { name: "البيت المحمي", plants: "نعناع · فلفل", moisture: 48, next: "ري تلقائي بعد 45 د", icon: "🪴", tone: "sand" },
  { name: "بستان الأشجار", plants: "ليمون · زيتون", moisture: 74, next: "لا يحتاج ري اليوم", icon: "🌳", tone: "blue" },
];

export default function Home() {
  const [auto, setAuto] = useState(true);
  const [toast, setToast] = useState("");
  const [active, setActive] = useState("الرئيسية");
  const [watering, setWatering] = useState(false);
  const [listening, setListening] = useState(true);
  const [screenWatch, setScreenWatch] = useState(true);
  const [panel, setPanel] = useState<string | null>(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [notes, setNotes] = useState(["مراجعة حساس البيت المحمي", "شراء سماد عضوي", "فكرة لتطوير التنبيهات"]);
  const [tasks, setTasks] = useState([{title:"اجتماع الفريق",time:"4:00 م",done:false},{title:"تعبئة خزان السماد",time:"اليوم",done:false},{title:"تنظيف حساس الرطوبة",time:"الأحد",done:false}]);
  const [storageReady,setStorageReady]=useState(false);
  const say = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2400); };
  const go = (name: string, id?: string) => { setActive(name); if (id) document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}); else window.scrollTo({top:0,behavior:"smooth"}); };
  useEffect(()=>{const n=localStorage.getItem("navixa-notes");const t=localStorage.getItem("navixa-tasks");if(n)setNotes(JSON.parse(n));if(t)setTasks(JSON.parse(t));setStorageReady(true)},[]);
  useEffect(()=>{if(storageReady)localStorage.setItem("navixa-notes",JSON.stringify(notes))},[notes,storageReady]);
  useEffect(()=>{if(storageReady)localStorage.setItem("navixa-tasks",JSON.stringify(tasks))},[tasks,storageReady]);
  useEffect(()=>{if(!focusSeconds)return;const timer=setInterval(()=>setFocusSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(timer)},[focusSeconds]);

  return <main dir="rtl" className="shell">
    {toast && <div className="toast">✓ {toast}</div>}
    <aside>
      <div className="logo"><span>ن</span><div><b>NAVIXA</b><small>المساعد الذكي</small></div></div>
      <nav>
        {[{n:"الرئيسية"},{n:"مساعدي",id:"assistant"},{n:"المزرعة",id:"garden"},{n:"الأتمتة",id:"automation"},{n:"المهام",panel:"المهام"}].map((x, i) => <button key={x.n} className={active === x.n ? "on" : ""} onClick={() => x.panel ? (setActive(x.n),setPanel(x.panel)) : go(x.n,x.id)}><i>{["⌂","◉","♧","✦","✓"][i]}</i>{x.n}{x.n === "المهام" && <em>2</em>}</button>)}
      </nav>
      <div className="side-bottom"><a className="admin-link" href="/admin">⚙ لوحة الإدارة <span>←</span></a><div className="user"><span>م</span><div><b>محمد</b><small>مزرعة الروضة</small></div><i>⋮</i></div></div>
    </aside>

    <section className="page">
      <header><div className="mobile-logo">N</div><div><small>الخميس، 31 يوليو</small><h1>هلا محمد، حديقتك بخير 🌱</h1></div><div className="head-actions"><a className="admin-top" href="/admin">⚙ دخول الإدارة</a><button onClick={() => setPanel("التنبيهات")}>♢<i/></button><span className="weather">☀ <b>28°</b><small>الرياض</small></span></div></header>

      <section className="explain">
        <div><span className="kicker">NAVIXA · ذكاء حاضر معك</span><h2>يسمعك، يراقب مهامك، <strong>وينفّذ عنك.</strong></h2><p>مساعد واحد يجمع يومك ومزرعتك: ينبّهك عند سماع اسمك، يتابع الشاشة، يذكّرك بالمواعيد، ويدير الري والحساسات تلقائيًا.</p><div className="concept"><span>يسمع ويفهم</span><i>←</i><span>ينبّه ويقرر</span><i>←</i><span>ينفّذ تلقائيًا</span></div></div>
        <div className="plant-scene"><span className="sun">☀</span><span className="cloud">☁</span><div className="plant">🌱</div><div className="soil"><i/><i/><i/></div><div className="sensor"><b>62%</b><small>رطوبة ممتازة</small></div></div>
      </section>

      <section className="assistant-hub" id="assistant">
        <div className="garden-head"><div><small>مساعدي الذكي</small><h2>كل أدوات NAVIXA في مكان واحد</h2><p>شغّالة معك أثناء الدراسة، العمل والاجتماعات</p></div><button onClick={() => setPanel("الأدوات")}>كل الأدوات ←</button></div>
        <div className="tools-grid">
          <article className="tool featured"><div className="tool-top"><span className="tool-icon mic">◉</span><label><input aria-label="متابعة نطق الاسم" type="checkbox" checked={listening} onChange={()=>{setListening(!listening);say(!listening?"بدأ NAVIXA الاستماع لاسمك":"توقفت متابعة الاسم")}}/><i/></label></div><h3>متابعة نطق الاسم</h3><p>ينبّهك فورًا عند سماع اسمك في الاجتماع أو المحاضرة.</p><div className="tool-live"><i className={listening?"wave":""}/> {listening ? "يستمع الآن لاسم: محمد" : "متوقف مؤقتًا"}</div></article>
          <article className="tool featured"><div className="tool-top"><span className="tool-icon screen">▣</span><label><input aria-label="مراقبة الشاشة" type="checkbox" checked={screenWatch} onChange={()=>{setScreenWatch(!screenWatch);say(!screenWatch?"بدأت مراقبة الشاشة":"توقفت مراقبة الشاشة")}}/><i/></label></div><h3>مراقبة الشاشة</h3><p>ينبّهك عند مغادرة الشاشة أو حدوث تغيير مهم فيها.</p><div className="tool-live"><i className={screenWatch?"safe":""}/> {screenWatch ? "الشاشة تحت المتابعة" : "المتابعة متوقفة"}</div></article>
          <article className="tool" onClick={()=>setPanel("المهام")}><span className="tool-icon calendar">▦</span><h3>المواعيد والمهام</h3><p>تذكيرات ذكية لا تفوّت معها أي موعد.</p><b>اجتماع الفريق · 4:00 م</b></article>
          <article className="tool" onClick={()=>setPanel("التركيز")}><span className="tool-icon focus">◎</span><h3>جلسة تركيز</h3><p>بومودورو ذكي مع تنبيهات الراحة.</p><b>ابدأ 25 دقيقة ←</b></article>
          <article className="tool" onClick={()=>setPanel("الملاحظات")}><span className="tool-icon notes">▤</span><h3>ملاحظات سريعة</h3><p>دوّن أفكارك وصدّرها في أي وقت.</p><b>{notes.length} ملاحظات محفوظة</b></article>
          <article className="tool" onClick={()=>setPanel("الروابط")}><span className="tool-icon links">⌁</span><h3>روابط سريعة</h3><p>كل روابطك المهمة بضغطة واحدة.</p><b>8 روابط مثبتة</b></article>
        </div>
      </section>

      <section className="now" id="automation">
        <div className="section-title"><div><span>الآن</span><h2>وش قاعد يصير في حديقتك؟</h2></div><p><i/> جميع الأجهزة متصلة</p></div>
        <div className="now-grid">
          <article className="status-card"><div className="status-top"><span className="auto-mark">✦</span><div><small>نفكسا يدير المزرعة</small><h3>{auto ? "الأتمتة تعمل" : "التحكم اليدوي"}</h3></div><label><input aria-label="تشغيل الأتمتة" type="checkbox" checked={auto} onChange={() => {setAuto(!auto);say(!auto ? "رجعت الأتمتة للعمل" : "تم التحويل للتحكم اليدوي")}}/><i/></label></div><p>{auto ? "لا تحتاج تسوي شيء الآن. النظام يراقب الرطوبة والطقس ويتصرف تلقائيًا." : "الأتمتة متوقفة مؤقتًا. يمكنك ري المناطق يدويًا."}</p><div className="next"><span>♢</span><div><small>الخطوة القادمة</small><b>ري البيت المحمي · بعد 45 دقيقة</b></div><em>12 دقيقة</em></div></article>
          <article className="attention"><div className="attention-title"><span>!</span><div><small>يحتاج انتباهك</small><h3>مهمتان بسيطتان</h3></div></div><button onClick={() => say("تمت إضافة السماد إلى مهامك")}><span className="task-icon">🧴</span><div><b>خزان السماد قرب يخلص</b><small>متبقي تقريبًا 15%</small></div><i>←</i></button><button onClick={() => say("تم تأجيل تنظيف الحساس ليوم الأحد")}><span className="task-icon">◌</span><div><b>تنظيف حساس الرطوبة</b><small>المنطقة الخارجية · هذا الأسبوع</small></div><i>←</i></button></article>
        </div>
      </section>

      <section className="summary">
        <article><span className="drop">♢</span><div><small>وفّرت هذا الشهر</small><b>1,240 <em>لتر ماء</em></b></div><i>أكثر بـ 24% ↑</i></article>
        <article><span className="heart">♡</span><div><small>صحة الحديقة</small><b>94<em>%</em></b></div><i>ممتازة</i></article>
        <article><span className="bolt">ϟ</span><div><small>مهام تمت تلقائيًا</small><b>38 <em>مهمة</em></b></div><i>بدون تدخل منك</i></article>
      </section>

      <section className="garden" id="garden">
        <div className="garden-head"><div><small>مزرعة الروضة</small><h2>كل منطقة في لمحة</h2></div><button onClick={() => setPanel("تفاصيل المزرعة")}>التفاصيل كاملة ←</button></div>
        <div className="area-grid">{areas.map((a, idx) => <article key={a.name} className="area"><div className={`area-image ${a.tone}`}><span>{a.icon}</span><em className={idx === 1 ? "soon" : "good"}>● {idx === 1 ? "ري قريب" : "ممتاز"}</em></div><div className="area-body"><h3>{a.name}</h3><p>{a.plants}</p><div className="reading"><span>رطوبة التربة</span><b>{a.moisture}%</b></div><div className="meter"><i style={{width:`${a.moisture}%`}}/></div><div className="next-row"><span>♢</span><small>{a.next}</small></div><button onClick={() => {setWatering(true);say(`بدأ ري ${a.name}`);setTimeout(()=>setWatering(false),2500)}}>{watering ? "الري يعمل الآن..." : "ري الآن"}</button></div></article>)}
          <button className="add" onClick={() => setPanel("إضافة منطقة")}><span>＋</span><b>أضف منطقة</b><small>اربط الحساس وخلك مرتاح</small></button>
        </div>
      </section>

      <section className="ask"><span>✦</span><div><small>اسأل نفكسا</small><h2>“هل تحتاج حديقتي ري اليوم؟”</h2></div><button onClick={() => setPanel("اسأل NAVIXA")}>اسأل الآن ←</button></section>
    </section>
    {panel && <div className="action-back" onClick={()=>setPanel(null)}><section className="action-panel" onClick={e=>e.stopPropagation()}><button className="action-close" onClick={()=>setPanel(null)}>×</button><small>NAVIXA</small><h2>{panel}</h2>
      {panel==="المهام" && <><div className="real-list">{tasks.map((t,i)=><label key={`${t.title}-${i}`}><input type="checkbox" checked={t.done} onChange={()=>setTasks(tasks.map((x,j)=>j===i?{...x,done:!x.done}:x))}/><span className={t.done?"done":""}>{t.title}</span><time>{t.time}</time><button onClick={()=>setTasks(tasks.filter((_,j)=>j!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setTasks([...tasks,{title:String(f.get("task")),time:"الآن",done:false}]);e.currentTarget.reset();say("تمت إضافة المهمة وحفظها")}}><input name="task" required placeholder="اكتب مهمة جديدة..."/><button>إضافة المهمة</button></form></>}
      {panel==="التركيز" && <div className="focus-panel"><b>{focusSeconds?`${String(Math.floor(focusSeconds/60)).padStart(2,"0")}:${String(focusSeconds%60).padStart(2,"0")}`:`${focusMinutes}:00`}</b><p>{focusSeconds?"جلسة التركيز تعمل الآن":"اختر مدة الجلسة ثم ابدأ المؤقت"}</p><div>{[15,25,45,60].map(n=><button disabled={!!focusSeconds} className={focusMinutes===n?"on":""} key={n} onClick={()=>setFocusMinutes(n)}>{n} دقيقة</button>)}</div><button className="primary" onClick={()=>focusSeconds?setFocusSeconds(0):setFocusSeconds(focusMinutes*60)}>{focusSeconds?"إيقاف المؤقت":"بدء جلسة التركيز"}</button></div>}
      {panel==="الملاحظات" && <><div className="real-list">{notes.map((n,i)=><label key={n}><span>▤ {n}</span><button onClick={()=>setNotes(notes.filter((_,x)=>x!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setNotes([...notes,String(f.get("note"))]);e.currentTarget.reset()}}><input name="note" required placeholder="اكتب ملاحظة..."/><button>حفظ</button></form></>}
      {panel==="الروابط" && <div className="quick-links"><a href="https://calendar.google.com" target="_blank">التقويم ↗</a><a href="https://drive.google.com" target="_blank">Google Drive ↗</a><a href="https://meet.google.com" target="_blank">Google Meet ↗</a><a href="/admin">لوحة الإدارة ←</a></div>}
      {panel==="التنبيهات" && <div className="real-list"><label><span>♢ رطوبة البيت المحمي منخفضة</span><time>منذ 8 دقائق</time></label><label><span>✓ اكتمل الري بنجاح</span><time>منذ 32 دقيقة</time></label></div>}
      {panel==="إضافة منطقة" && <form onSubmit={e=>{e.preventDefault();say("تمت إضافة المنطقة الجديدة");setPanel(null)}}><input required placeholder="اسم المنطقة"/><select><option>حديقة منزلية</option><option>حقل زراعي</option><option>بيت محمي</option><option>بستان أشجار</option></select><input required placeholder="رمز الحساس"/><button>ربط وإضافة المنطقة</button></form>}
      {panel==="اسأل NAVIXA" && <><div className="ai-answer">حديقتك لا تحتاج ري شامل اليوم. البيت المحمي فقط سيُروى تلقائيًا بعد 45 دقيقة لمدة 12 دقيقة.</div><form onSubmit={e=>{e.preventDefault();say("تم إرسال سؤالك إلى NAVIXA")}}><input required placeholder="اسأل عن مزرعتك أو مهامك..."/><button>إرسال</button></form></>}
      {panel==="تفاصيل المزرعة" && <div className="real-list">{areas.map(a=><label key={a.name}><span>{a.icon} {a.name}</span><b>{a.moisture}% رطوبة</b></label>)}</div>}
      {panel==="الأدوات" && <div className="quick-links"><button onClick={()=>setPanel("المهام")}>▦ المواعيد والمهام</button><button onClick={()=>setPanel("التركيز")}>◎ جلسة تركيز</button><button onClick={()=>setPanel("الملاحظات")}>▤ الملاحظات</button><button onClick={()=>setPanel("الروابط")}>⌁ الروابط السريعة</button></div>}
    </section></div>}
  </main>;
}
