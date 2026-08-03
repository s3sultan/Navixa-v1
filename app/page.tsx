"use client";

import { useEffect, useRef, useState } from "react";
import "./navixa.css";
import "./welcome.css";
import FloatingAssistant from "./FloatingAssistant";
import GameAdBox from "./GameAdBox";
import HealthNudge from "./HealthNudge";

type Task={title:string;done:boolean;meta?:string};
const starters:Task[]=[{title:"مراجعة خطة المشروع",done:false},{title:"تأكيد موعد الفريق",done:true},{title:"إنهاء ملخص الاجتماع",done:false}];

export default function Home(){
  const [tasks,setTasks]=useState<Task[]>(starters);
  const [ready,setReady]=useState(false);
  const [seconds,setSeconds]=useState(25*60);
  const [running,setRunning]=useState(false);
  const [listening,setListening]=useState(false);
  const [screen,setScreen]=useState(false);
  const [entered,setEntered]=useState(false);
  const [welcomeSwipe,setWelcomeSwipe]=useState(0);
  const [quoteIndex,setQuoteIndex]=useState(0);
  const [watchTerms,setWatchTerms]=useState("");
  const [heardText,setHeardText]=useState("");
  const [interimText,setInterimText]=useState("");
  const [alertSound,setAlertSound]=useState("chime");
  const [social,setSocial]=useState({x:"https://x.com",instagram:"https://instagram.com",youtube:"https://youtube.com",github:"https://github.com"});
  const [automations,setAutomations]=useState([{icon:"☀",name:"بداية اليوم",when:"كل صباح · 7:00",action:"ملخص المهام والطقس والمواعيد",on:true},{icon:"◉",name:"وقت الاجتماع",when:"عند بدء الاجتماع",action:"تشغيل متابعة الاسم وتدوين النقاط",on:true},{icon:"◎",name:"وضع التركيز",when:"أيام العمل · 6:30 م",action:"كتم التنبيهات وبدء مؤقت التركيز",on:false}]);
  const [toast,setToast]=useState("");
  const [modal,setModal]=useState<"tasks"|"ask"|"notifications"|"automation"|"screen"|null>(null);
  const recognitionRef=useRef<any>(null);
  const screenRef=useRef<MediaStream|null>(null);
  const lastIntentRef=useRef("");
  const welcomeTrackRef=useRef<HTMLDivElement>(null);
  const playAlert=(sound=alertSound)=>{if(sound==="silent")return;try{const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;const ctx=new AudioCtx();const patterns:Record<string,number[]>={chime:[659,880],bell:[784,659,784],pulse:[440,440,660],urgent:[880,660,880,660]};const notes=patterns[sound]||patterns.chime;notes.forEach((frequency,index)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();const start=ctx.currentTime+index*.18;oscillator.type=sound==="urgent"?"square":"sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(sound==="urgent"?.13:.2,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.18)});setTimeout(()=>ctx.close(),notes.length*180+300)}catch{}}
  const notify=(message:string)=>{playAlert();setToast(message);setTimeout(()=>setToast(""),2200)};
  useEffect(()=>{const saved=localStorage.getItem("navixa-life-tasks");const savedSocial=localStorage.getItem("navixa-social");const savedSound=localStorage.getItem("navixa-alert-sound");if(saved)setTasks(JSON.parse(saved));if(savedSocial)setSocial(JSON.parse(savedSocial));if(savedSound)setAlertSound(savedSound);setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-alert-sound",alertSound)},[alertSound,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-life-tasks",JSON.stringify(tasks))},[tasks,ready]);
  useEffect(()=>{const timer=setInterval(()=>setQuoteIndex(i=>(i+1)%4),3200);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);notify("أحسنت! انتهت جلسة التركيز");return 25*60}return s-1}),1000);return()=>clearInterval(timer)},[running]);
  const time=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  const captureSpokenIntent=(spoken:string)=>{const text=spoken.trim();if(!text||text===lastIntentRef.current)return;const kinds=[{words:["موعد","اجتماع","مقابلة"],label:"موعد"},{words:["كويز","اختبار","امتحان"],label:"اختبار"},{words:["تاريخ","تسليم","ددلاين"],label:"تاريخ مهم"},{words:["ملاحظة","لاحظ","ركز على","تذكر"],label:"ملاحظة"}];const kind=kinds.find(k=>k.words.some(w=>text.includes(w)));if(!kind)return;const date=text.match(/(?:اليوم|بكرة|غدا|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|الساعة\s+\d{1,2}(?::\d{2})?)/)?.[0]||"من الكلام المسموع";lastIntentRef.current=text;setTasks(current=>[...current,{title:`${kind.label}: ${text}`,done:false,meta:date}]);setModal("tasks");notify(`فهمت ${kind.label} وأضفته للمهام`)};
  const toggleListening=()=>{
    if(listening){recognitionRef.current?.stop();setListening(false);return}
    const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition){notify("متصفحك لا يدعم الاستماع الصوتي");return}
    const recognition=new SpeechRecognition();recognition.lang="ar-SA";recognition.continuous=true;recognition.interimResults=true;
    recognition.onresult=(event:any)=>{let interim="";for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i];const text=result[0].transcript;const normalized=text.replace(/[،,.؛:!?]/g," ").replace(/\s+/g," ").trim().toLowerCase();const terms=watchTerms.split(/[،,\n]/).map(x=>x.replace(/[،,.؛:!?]/g," ").replace(/\s+/g," ").trim().toLowerCase()).filter(Boolean);const matched=terms.find(term=>normalized.includes(term));if(matched)notify(`تم سماع الكلمة: ${matched}`);if(result.isFinal){setHeardText(previous=>`${previous} ${text}`.trim().slice(-5000));captureSpokenIntent(text)}else interim+=`${text} `}setInterimText(interim.trim())};
    recognition.onerror=()=>{setListening(false);notify("تعذر تشغيل الميكروفون — تحقق من الصلاحية")};recognition.onend=()=>setListening(false);
    recognitionRef.current=recognition;recognition.start();setListening(true);notify("بدأ الاستماع للكلمات المختارة");
  };
  const toggleScreen=async()=>{
    if(screen){screenRef.current?.getTracks().forEach(t=>t.stop());screenRef.current=null;setScreen(false);return}
    try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screenRef.current=stream;stream.getVideoTracks()[0].onended=()=>{setScreen(false);screenRef.current=null};setScreen(true);notify("اسحب الإطار داخل البطاقة لتحديد منطقة المتابعة")}
    catch{notify("لم تبدأ المشاركة — اختر شاشة واسمح بالصلاحية")}
  };

  const hour=new Date().getHours();const greeting=hour<12?"صباح الخير":hour<18?"مساء الخير":"مساء النور";
  const welcomeQuotes=["خطوة بسيطة اليوم تصنع فرقًا كبيرًا بكرة.","رتّب يومك بهدوء، والإنجاز يتبعك.","كل دقيقة تركيز تقرّبك من هدفك.","ابدأ بخطوة واحدة، والباقي يصير أسهل."];
  const moveWelcomeSwipe=(clientX:number)=>{const track=welcomeTrackRef.current;if(!track)return;const rect=track.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(rect.right-clientX)/(rect.width-72)));setWelcomeSwipe(progress);if(progress>.93)setEntered(true)};
  return <main className={`nx ${entered?"entered":"waiting"}`} dir="rtl">
    {!entered&&<section className="welcome"><div className="welcome-pattern"/><div className="welcome-orb one"/><div className="welcome-orb two"/><div className="navixa-mark"><i/><i/></div><small>{greeting}</small><h1>يفهم يومك <b>NAVIXA</b></h1><p>مساعدك الذكي يرتب يومك، يلتقط المواعيد والملاحظات، ويساعدك على التركيز—مع خصوصيتك أولًا.</p><blockquote key={quoteIndex}>“{welcomeQuotes[quoteIndex]}”</blockquote><div className="welcome-benefits"><span>◉ متابعة ذكية</span><span>▣ مراقبة محلية</span><span>◎ تركيز وصحة</span></div><div ref={welcomeTrackRef} className="welcome-swipe" onPointerMove={e=>moveWelcomeSwipe(e.clientX)} onPointerUp={()=>setWelcomeSwipe(0)} onPointerLeave={()=>setWelcomeSwipe(0)}><b>اسحب للدخول</b><button aria-label="اسحب شعار NAVIXA من اليمين إلى اليسار" style={{right:`calc(6px + ${welcomeSwipe*100}% - ${welcomeSwipe*76}px)`}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)}}><i/><i/></button><span>←</span></div><em>🔒 لا يعمل الميكروفون أو الشاشة إلا بموافقتك الصريحة</em></section>}
    {toast&&<div className="nx-toast">✓ {toast}</div>}
    <aside className="nx-side">
      <a className="nx-brand" href="#top"><span>ن</span><div><b>NAVIXA</b><small>مساعدك اليومي</small></div></a>
      <nav>
        <a className="active" href="#top"><i>⌂</i> اليوم</a>
        <a href="#assistant"><i>✦</i> مساعدي</a>
        <button onClick={()=>setModal("tasks")}><i>✓</i> المهام <em>{tasks.filter(t=>!t.done).length}</em></button>
        <a href="#focus"><i>◎</i> التركيز</a>
        <a href="/health"><i>♡</i> صحتي</a>
        <a href="#automations"><i>⌘</i> الأتمتة</a>
      </nav>
      <details className="side-sound"><summary>♫ صوت التنبيهات</summary><div>{[["chime","رنين هادئ"],["bell","جرس واضح"],["pulse","نبض سريع"],["urgent","تنبيه مهم"],["silent","بدون صوت"]].map(([value,label])=><label key={value}><input type="radio" name="side-alert-sound" checked={alertSound===value} onChange={()=>setAlertSound(value)}/><span>{label}</span><button type="button" onClick={()=>playAlert(value)}>تجربة</button></label>)}</div></details>
      <a className="nx-user admin-user-entry" href="/admin/login"><span className="side-mark"><i/><i/></span><div><b>دخول الإدارة</b><small>مركز تحكم NAVIXA</small></div><i>←</i></a>
    </aside>

    <section className="nx-page" id="top">
      <header className="nx-head"><a className="mobile-brand" href="#top">N</a><div><small>يوم جديد · فرصة جديدة</small><h1>{greeting}، وش ودّك تنجز اليوم؟</h1></div><div><button aria-label="التنبيهات" onClick={()=>setModal("notifications")}>♢<i/></button></div></header>

      <section className="nx-hero showcase">
        <div className="arch one"/><div className="arch two"/><div className="saudi-pattern"/>
        <div className="lavender lavender-a">⚘<br/>⚘<br/>⚘</div><div className="lavender lavender-b">⚘ ⚘</div>
        <aside className="day-board"><div className="board-title"><b>اليوم</b><span>⌄</span></div><article><i>▣</i><p><b>أولويات</b><small>مراجعة أهداف اليوم</small></p></article><article><i>▰</i><p><b>مشاريع</b><small>تقرير أداء المشروع</small></p></article><article><i>♙</i><p><b>اجتماعات</b><small>مراجعة خطة الربع</small></p></article><article><i>✓</i><p><b>مهام</b><small>{tasks.filter(t=>!t.done).length} مهام متبقية</small></p></article></aside>
        <div className="hero-center"><div className="navixa-mark"><i/><i/></div><h2>NAVIXA</h2><h3>ذكاء يفهم يومك</h3><button className="main-ask" onClick={()=>setModal("ask")}><span>✦</span> كيف يمكنني مساعدتك اليوم؟ <i>↑</i></button><div className="quick-prompts"><button onClick={()=>setModal("ask")}>تخطيط الأسبوع ▦</button><button onClick={()=>setModal("tasks")}>تنظيم المهام ✓</button><button onClick={()=>setModal("ask")}>إعداد عرض ▣</button><button onClick={()=>setModal("ask")}>تلخيص المستندات ▤</button></div></div>
        <div className="smart-note"><small>مساعدك الذكي</small><p>لخّص لي نقاط الاجتماع<br/>واقترح الإجراءات التالية</p><button onClick={()=>setModal("ask")}>✦</button></div>
        <button className="focus-card" onClick={()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"})}><b>تركيز</b><span>{time}</span><small>جلسة تركيز</small><i/></button>
      </section>

      <section className="daily-strip"><div><small>إنجاز اليوم</small><b>72%</b><span><i style={{width:"72%"}}/></span></div><div><small>وقت التركيز</small><b>2س 15د</b><em>↑ 24 دقيقة</em></div><div><small>المهام المكتملة</small><b>{tasks.filter(t=>t.done).length} / {tasks.length}</b><em>ممتاز، كمّل</em></div><div><small>موعدك القادم</small><b>09:30</b><em>بعد 35 دقيقة</em></div></section>

      <section className="nx-section" id="assistant"><div className="section-head"><div><small>مساعدك الذكي</small><h2>كل ما تحتاجه ليوم أوضح</h2><p>أدوات مرنة تساعدك في العمل والمشاريع والمواعيد والحياة اليومية.</p></div></div>
        <div className="feature-grid">
          <article className="wide lavender name-listener command-card"><div className="feature-icon">◉</div><div><small>استماع ذكي</small><h3>الأسماء والكلمات المهمة</h3><p>اكتب أكثر من اسم أو كلمة وافصل بينها بفاصلة. المسافات وعلامات الترقيم لا تؤثر.</p><input aria-label="الأسماء والكلمات" value={watchTerms} onChange={e=>setWatchTerms(e.target.value)} placeholder="اسم أو كلمة، موعد، إجراء مهم"/><div className="heard-panel"><label>ما يسمعه NAVIXA الآن</label><textarea aria-label="النص الذي يسمعه الذكاء" value={[heardText,interimText].filter(Boolean).join(" ")} readOnly placeholder="سيظهر الكلام هنا مباشرة بعد تشغيل الاستماع..."/><div><button onClick={()=>{const text=[heardText,interimText].filter(Boolean).join(" ");if(!text)return notify("لا يوجد نص بعد");navigator.clipboard?.writeText(text);notify("تم نسخ النص المسموع")}}>نسخ النص</button><button onClick={()=>{const text=[heardText,interimText].filter(Boolean).join(" ").trim();if(!text)return notify("لا يوجد نص لإضافته");setTasks(current=>[...current,{title:text,done:false,meta:"من الاستماع الذكي"}]);notify("تمت إضافة النص إلى المهام")}}>إضافة للمهام</button><button className="clear-heard" onClick={()=>{setHeardText("");setInterimText("")}}>مسح</button></div></div><button className="listen-toggle" onClick={toggleListening}>{listening?"إيقاف":"تشغيل الاستماع"}</button></div><span className={`status ${listening?"live":""}`}>{listening?"● يحلل الآن":"○ متوقف"}</span></article>
          <article className="wide green command-card"><div className="feature-icon">▣</div><div><small>متابعة الشاشة</small><h3>شارك ثم حدّد المنطقة</h3><p>بعد اختيار الشاشة يظهر إطار المنطقة؛ المتابعة محلية ولا تحفظ صورة الشاشة.</p>{screen&&<div className="screen-selector mini"><div className="selection-box"><span>منطقة المتابعة</span></div></div>}<button onClick={toggleScreen}>{screen?"إنهاء المشاركة":"اختيار شاشة"}</button></div><span className={`status ${screen?"live":""}`}>{screen?"● منطقة محددة":"○ غير مفعّل"}</span></article>
          <article><div className="feature-icon">▦</div><small>تنظيم</small><h3>مهام ومواعيد</h3><p>رتّب يومك وتابع إنجازك بدون تعقيد.</p><button onClick={()=>setModal("tasks")}>فتح المهام ←</button></article>
          <article><div className="feature-icon">▤</div><small>ذكاء عملي</small><h3>تلخيص سريع</h3><p>حوّل النصوص والاجتماعات إلى نقاط واضحة.</p><button onClick={()=>setModal("ask")}>ابدأ التلخيص ←</button></article>
          <article><div className="feature-icon">⌁</div><small>في مكان واحد</small><h3>روابطك المهمة</h3><p>ثبّت أدوات العمل والحياة التي تستخدمها يوميًا.</p><a href="https://calendar.google.com" target="_blank">فتح التقويم ↗</a></article>
        </div>
      </section>

      <section className="health-gateway"><div><span>♡</span><div><small>مركز NAVIXA الصحي</small><h2>جلستك، حركتك وماءك في صفحة واحدة</h2><p>مراقبة محلية للجلوس، تمارين سريعة وتذكيرات واضحة.</p></div></div><a href="/health">فتح صحتي ←</a></section>
      <section className="focus-zone" id="focus"><div><small>جلسة تركيز</small><h2>خذ وقتك. خلّ الباقي علينا.</h2><p>مؤقت بسيط يساعدك تنجز بعيدًا عن التشتت.</p><div className="focus-actions"><button onClick={()=>setRunning(!running)}>{running?"إيقاف مؤقت":"ابدأ 25 دقيقة"}</button><button className="ghost" onClick={()=>{setRunning(false);setSeconds(25*60)}}>إعادة</button></div></div><div className={`timer ${running?"running":""}`}><span>{time}</span><small>{running?"أنت الآن في وضع التركيز":"جاهز متى ما كنت"}</small></div><div className="lavender-stem">✦</div></section>

      <section className="nx-section automation" id="automations"><div className="section-head"><div><small>الأتمتة</small><h2>NAVIXA يختصر الخطوات عنك</h2><p>قواعد بسيطة تتكرر تلقائيًا في وقتها.</p></div><button onClick={()=>setModal("automation")}>＋ أتمتة جديدة</button></div><div className="automation-list">{automations.map((x,i)=><article key={`${x.name}-${i}`}><span>{x.icon}</span><div><b>{x.name}</b><small>{x.when}</small></div><p>{x.action}</p><label><input aria-label={`تفعيل ${x.name}`} type="checkbox" checked={x.on} onChange={()=>setAutomations(automations.map((a,j)=>j===i?{...a,on:!a.on}:a))}/><i/></label></article>)}</div></section>

      <section className="proof-grid"><article><span>♙</span><b>12.8K+</b><small>مستخدم نشط في NAVIXA</small></article><article><span>◷</span><b>85,000+</b><small>ساعة إنتاجية مسجلة</small></article><article><span>☆</span><b>4.9/5</b><small>تقييم المستخدمين</small></article><article><span>♢</span><b>100%</b><small>خصوصية — بياناتك على جهازك</small></article></section>
      <section className="faq"><h2>🛡️ دليل الثقة والاستخدام الذكي</h2>{[["هل NAVIXA آمن لبياناتي؟","نعم. لا يبدأ الميكروفون أو مشاركة الشاشة إلا بعد ضغطك وموافقتك على صلاحية المتصفح."],["هل تُرفع الشاشة أو التسجيلات إلى الموقع؟","لا. المعالجة تتم داخل جلسة المتصفح ولا يحفظ الموقع صورة الشاشة أو التسجيل الصوتي."],["هل يعمل أثناء الاجتماعات الحضورية والأونلاين؟","نعم، عند تفعيل الاستماع يمكنه رصد الكلمات التي تختارها من الصوت الذي تسمح به للمتصفح."],["هل أحتاج لتسجيل حساب؟","لاستخدام الصفحة اليومية لا، أما لوحة الإدارة فلها صفحة دخول مستقلة."],["كيف يكتشف المعلومات تلقائيًا؟","من الصلاحيات التي تمنحها أنت فقط، ومن الأتمتة التي تنشئها وتفعّلها."],["كيف أوقف الصلاحيات؟","اضغط إيقاف داخل البطاقة أو استخدم مؤشر المشاركة في المتصفح لإيقافها فورًا."],["هل يمكنني إضافة أكثر من اسم؟","نعم، اكتب الأسماء أو الكلمات وافصلها بفاصلة، ولن تؤثر المسافات أو علامات الترقيم."],["هل يعمل بالعربي والإنجليزي؟","الواجهة عربية حاليًا، ويمكن توسيع الاستماع والواجهة للغات إضافية."]].map(x=><details key={x[0]}><summary>{x[0]}<span>⌄</span></summary><p>{x[1]}</p></details>)}</section>
      <section className="contact"><h2>🌐 تواصل معنا</h2><p>تابعنا على حساباتنا الرسمية</p><div><a href="mailto:hello@navixa.sa">✉</a><a href={social.x} target="_blank">𝕏</a><a href={social.instagram} target="_blank">◎</a><a href={social.youtube} target="_blank">▶</a><a href={social.github} target="_blank">◉</a></div></section>

      <footer><div className="nx-brand"><span>ن</span><div><b>NAVIXA</b><small>ذكاء يفهم يومك</small></div></div><p>مصمم لحياة أكثر ترتيبًا للجميع.</p><span>© 2026 NAVIXA</span></footer>
    </section>

    {modal&&<div className="nx-modal-back" onClick={()=>setModal(null)}><section className="nx-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button>{modal==="tasks"?<><small>مهامي</small><h2>خلّ يومك واضح</h2><div className="task-list">{tasks.map((t,i)=><label key={`${t.title}-${i}`}><input type="checkbox" checked={t.done} onChange={()=>setTasks(tasks.map((x,j)=>j===i?{...x,done:!x.done}:x))}/><span className={t.done?"done":""}>{t.title}</span><button onClick={()=>setTasks(tasks.filter((_,j)=>j!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);setTasks([...tasks,{title:String(data.get("task")),done:false}]);e.currentTarget.reset()}}><input name="task" required placeholder="أضف مهمة جديدة..."/><button>إضافة</button></form></>:modal==="notifications"?<><small>التنبيهات</small><h2>آخر التنبيهات</h2><div className="notification-list"><article><b>اجتماع الفريق قريب</b><small>يبدأ بعد 35 دقيقة</small></article><article><b>مهمتان تحتاجان الإكمال</b><small>من قائمة اليوم</small></article><article><b>جلسة التركيز جاهزة</b><small>25 دقيقة مقترحة</small></article></div></>:modal==="automation"?<><small>أتمتة جديدة</small><h2>أنشئ قاعدة تتكرر تلقائيًا</h2><form className="stack-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);setAutomations([...automations,{icon:"✦",name:String(d.get("name")),when:String(d.get("when")),action:String(d.get("action")),on:true}]);setModal(null);notify("تمت إضافة الأتمتة وتشغيلها")}}><input name="name" required placeholder="اسم الأتمتة"/><input name="when" required placeholder="متى تعمل؟ مثال: كل يوم 8 صباحًا"/><input name="action" required placeholder="ماذا تنفذ؟"/><button>حفظ وتشغيل</button></form></>:<><small>مساعد NAVIXA</small><h2>وش أقدر أسوي لك يا سلطان؟</h2><div className="suggestions"><button onClick={()=>notify("جهزت لك خطة يوم متوازنة")}>رتّب يومي</button><button onClick={()=>notify("أرسل النص وسألخصه لك")}>لخّص لي</button><button onClick={()=>notify("بدأ تجهيز قائمة الأولويات")}>حدّد أولوياتي</button></div><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلبك إلى NAVIXA");setModal(null)}}><input required placeholder="اكتب طلبك هنا..."/><button>إرسال</button></form></>}</section></div>}
    <FloatingAssistant onAddTask={title=>{setTasks(current=>[...current,{title,done:false,meta:"استنتجها مساعد NAVIXA"}]);setModal("tasks");notify("تمت إضافة المطلوب للمهام")}}/>
    <GameAdBox/>
    <HealthNudge/>
  </main>
}
