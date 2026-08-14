"use client";

import { useEffect, useRef, useState } from "react";
import "./navixa.css";
import "./welcome.css";
import "./counter-extra.css";
import "./insights.css";
import FloatingAssistant from "./FloatingAssistant";
import GameAdBox from "./GameAdBox";
import HealthNudge from "./HealthNudge";
import DailyReviewCard from "./DailyReviewCard";
import WeeklyChallengeCard from "./WeeklyChallengeCard";
import BehaviorAnalysisCard from "./BehaviorAnalysisCard";
import FocusTasbihNudge from "./FocusTasbihNudge";
import PrayerStrip from "./PrayerStrip";
import NotificationCenter from "./NotificationCenter";
import {isScreenEnabled,sendTelegramAlert} from "./alertPrefs";

type Task={title:string;done:boolean;meta?:string};
type SmartTool="listener"|"screen"|"tasks"|"summary"|"links";
const starters:Task[]=[{title:"مراجعة خطة المشروع",done:false},{title:"تأكيد موعد الفريق",done:true},{title:"إنهاء ملخص الاجتماع",done:false}];
const today=()=>new Date().toISOString().slice(0,10);
const computeBestHour=(hours:string[])=>{const counts:Record<number,number>={};hours.forEach(iso=>{const h=new Date(iso).getHours();counts[h]=(counts[h]||0)+1});const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return top?`${top[0]}:00`:null};

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
  const [heardMatch,setHeardMatch]=useState("");
  const [alertSound,setAlertSound]=useState("chime");
  const [typedWelcome,setTypedWelcome]=useState("");
  const [visitCount,setVisitCount]=useState(0);
  const [ehsanCount,setEhsanCount]=useState(0);
  const [showCounter,setShowCounter]=useState(true);
  const [social,setSocial]=useState({x:"https://x.com",instagram:"https://instagram.com",youtube:"https://youtube.com",github:"https://github.com"});
  const [automations,setAutomations]=useState([{icon:"☀",name:"بداية اليوم",when:"كل صباح · 7:00",action:"ملخص المهام والطقس والمواعيد",on:true},{icon:"◉",name:"وقت الاجتماع",when:"عند بدء الاجتماع",action:"تشغيل متابعة الاسم وتدوين النقاط",on:true},{icon:"◎",name:"وضع التركيز",when:"أيام العمل · 6:30 م",action:"كتم التنبيهات وبدء مؤقت التركيز",on:false}]);
  const [toast,setToast]=useState("");
  const [smartTool,setSmartTool]=useState<SmartTool|null>(null);
  const [screenSelection,setScreenSelection]=useState({x:18,y:18,w:64,h:54});
  const [screenMonitoring,setScreenMonitoring]=useState(true);
  const [screenSensitivity,setScreenSensitivity]=useState(18);
  const [screenAlert,setScreenAlert]=useState("");
  const [modal,setModal]=useState<"tasks"|"ask"|"automation"|"screen"|"alerts"|null>(null);
  const recognitionRef=useRef<any>(null);
  const listeningRequestedRef=useRef(false);
  const watchTermsRef=useRef("");
  const screenRef=useRef<MediaStream|null>(null);
  const screenVideoRef=useRef<HTMLVideoElement>(null);
  const screenCanvasRef=useRef<HTMLCanvasElement>(null);
  const screenPreviousRef=useRef<Uint8ClampedArray|null>(null);
  const screenMonitorTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const screenLastAlertRef=useRef(0);
  const screenDragRef=useRef<{mode:"draw"|"move"|"resize";startX:number;startY:number;origin:{x:number;y:number;w:number;h:number}}|null>(null);
  const lastIntentRef=useRef("");
  const lastNameAlertRef=useRef({name:"",at:0});
  const welcomeTrackRef=useRef<HTMLDivElement>(null);
  const playAlert=(sound=alertSound)=>{if(sound==="silent")return;try{const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;const ctx=new AudioCtx();const patterns:Record<string,number[]>={chime:[659,880],bell:[784,659,784],pulse:[440,440,660],urgent:[880,660,880,660]};const notes=patterns[sound]||patterns.chime;notes.forEach((frequency,index)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();const start=ctx.currentTime+index*.18;oscillator.type=sound==="urgent"?"square":"sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(sound==="urgent"?.13:.2,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.18)});setTimeout(()=>ctx.close(),notes.length*180+300)}catch{}}
  const notify=(message:string)=>{playAlert();setToast(message);setTimeout(()=>setToast(""),2200)};
  const [insightsTick,setInsightsTick]=useState(0);
  const logSession=()=>{const key=`navixa-sessions-${today()}`;const next=Number(localStorage.getItem(key)||0)+1;localStorage.setItem(key,String(next));const hours=JSON.parse(localStorage.getItem("navixa-session-hours")||"[]");hours.push(new Date().toISOString());localStorage.setItem("navixa-session-hours",JSON.stringify(hours.slice(-300)));setInsightsTick(t=>t+1)};
  const quickTask=()=>{setTasks(current=>[...current,{title:"مهمة سريعة",done:false,meta:"من مراجعة اليوم"}]);notify("تمت إضافة مهمة سريعة")};
  const normalizeName=(value:string)=>value.normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase();
  const splitWatchTerms=(value:string)=>value.split(/[،,;؛.!؟:|/\\\n]+/).flatMap(part=>part.trim().split(/\s+/)).map(normalizeName).filter(Boolean);
  const alertName=(name:string)=>{const now=Date.now();setHeardMatch(name);if(lastNameAlertRef.current.name===name&&now-lastNameAlertRef.current.at<15000)return;lastNameAlertRef.current={name,at:now};if(isScreenEnabled("name")){playAlert("urgent");setToast(`تنبيه: سمعنا الاسم (${name})`);setTimeout(()=>setToast(""),3500)}sendTelegramAlert("name",`تنبيه NAVIXA: تم سماع الاسم (${name})`)};
  useEffect(()=>{const saved=localStorage.getItem("navixa-life-tasks");const savedSocial=localStorage.getItem("navixa-social");const savedSound=localStorage.getItem("navixa-alert-sound");const savedTerms=localStorage.getItem("navixa-watch-terms");if(saved)setTasks(JSON.parse(saved));if(savedSocial)setSocial(JSON.parse(savedSocial));if(savedSound)setAlertSound(savedSound);if(savedTerms){setWatchTerms(savedTerms);watchTermsRef.current=savedTerms}setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-alert-sound",alertSound)},[alertSound,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-life-tasks",JSON.stringify(tasks))},[tasks,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-watch-terms",watchTerms)},[watchTerms,ready]);
  useEffect(()=>()=>{listeningRequestedRef.current=false;recognitionRef.current?.abort();recognitionRef.current=null},[]);
  useEffect(()=>{const timer=setInterval(()=>setQuoteIndex(i=>(i+1)%4),3200);return()=>clearInterval(timer)},[]);
  useEffect(()=>{const copy="مساعدك الذكي يرتب يومك، يلتقط المواعيد والملاحظات، يساعدك على التركيز والصحة—مع خصوصيتك أولًا.";let i=0;const timer=setInterval(()=>{i++;setTypedWelcome(copy.slice(0,i));if(i>=copy.length)clearInterval(timer)},28);const settings=JSON.parse(localStorage.getItem("navixa-counter-settings")||'{"enabled":true,"start":12840}');setShowCounter(settings.enabled!==false);const next=Number(localStorage.getItem("navixa-visit-count")||settings.start||12840)+1;localStorage.setItem("navixa-visit-count",String(next));setVisitCount(next);setEhsanCount(Number(localStorage.getItem("navixa-ehsan-clicks")||1200));return()=>clearInterval(timer)},[]);
  useEffect(()=>{const stored=localStorage.getItem("navixa-stats-visitor-key");const visitorKey=stored||((crypto as any).randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`);if(!stored)localStorage.setItem("navixa-stats-visitor-key",visitorKey);fetch("/api/stats",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:"visit",visitorKey})}).then(response=>response.json()).then(data=>{if(data?.configured&&data?.stats){setVisitCount(Number(data.stats.visits)||0);setEhsanCount(Number(data.stats.ehsan)||0)}}).catch(()=>{});},[]);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);if(isScreenEnabled("focus"))notify("أحسنت! انتهت جلسة التركيز");sendTelegramAlert("focus","🎯 تذكير NAVIXA: انتهت جلسة تركيز (25 دقيقة)");logSession();return 25*60}return s-1}),1000);return()=>clearInterval(timer)},[running]);
  const time=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  void insightsTick;
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});
  const daySessions=(d:string)=>Number(localStorage.getItem(`navixa-sessions-${d}`)||0);
  const dayCups=(d:string)=>Number(localStorage.getItem(`navixa-water-${d}`)||0);
  const weeklySessions=last7.map(d=>({date:d,count:ready?daySessions(d):0}));
  const todaySessions=ready?daySessions(today()):0;
  const weekSessionsTotal=weeklySessions.reduce((sum,w)=>sum+w.count,0);
  const weekHydrationDays=ready?last7.filter(d=>dayCups(d)>=6).length:0;
  const sessionHours:string[]=ready?JSON.parse(localStorage.getItem("navixa-session-hours")||"[]"):[];
  const bestHour=computeBestHour(sessionHours);
  const tasksDoneCount=tasks.filter(t=>t.done).length;
  const captureSpokenIntent=(spoken:string)=>{const text=spoken.trim();if(!text||text===lastIntentRef.current)return;const kinds=[{words:["موعد","اجتماع","مقابلة"],label:"موعد"},{words:["كويز","اختبار","امتحان"],label:"اختبار"},{words:["تاريخ","تسليم","ددلاين"],label:"تاريخ مهم"},{words:["ملاحظة","لاحظ","ركز على","تذكر"],label:"ملاحظة"}];const kind=kinds.find(k=>k.words.some(w=>text.includes(w)));if(!kind)return;const date=text.match(/(?:اليوم|بكرة|غدا|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|الساعة\s+\d{1,2}(?::\d{2})?)/)?.[0]||"من الكلام المسموع";lastIntentRef.current=text;setTasks(current=>[...current,{title:`${kind.label}: ${text}`,done:false,meta:date}]);setModal("tasks");notify(`فهمت ${kind.label} وأضفته للمهام`)};
  const toggleListening=()=>{
    if(listeningRequestedRef.current){listeningRequestedRef.current=false;recognitionRef.current?.stop();recognitionRef.current=null;setListening(false);setInterimText("");return}
    const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition){notify("متصفحك لا يدعم الاستماع الصوتي");return}
    const recognition=new SpeechRecognition();recognition.lang="ar-SA";recognition.continuous=true;recognition.interimResults=true;
    recognition.onstart=()=>setListening(true);
    recognition.onresult=(event:any)=>{let interim="";for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i],text=result[0].transcript,normalized=normalizeName(text),terms=splitWatchTerms(watchTermsRef.current),padded=` ${normalized} `,matched=terms.find(term=>padded.includes(` ${term} `));if(matched)alertName(matched);if(result.isFinal){setHeardText(previous=>`${previous} ${text}`.trim().slice(-5000));captureSpokenIntent(text)}else interim+=`${text} `}setInterimText(interim.trim())};
    recognition.onerror=(event:any)=>{if(event.error==="no-speech")return;listeningRequestedRef.current=false;recognitionRef.current=null;setListening(false);setInterimText("");notify(event.error==="not-allowed"?"لم تُمنح صلاحية الميكروفون":"تعذر تشغيل الاستماع — تحقق من الميكروفون")};
    recognition.onend=()=>{setListening(false);setInterimText("");if(listeningRequestedRef.current)setTimeout(()=>{try{recognition.start()}catch{listeningRequestedRef.current=false;recognitionRef.current=null}},250);else recognitionRef.current=null};
    listeningRequestedRef.current=true;recognitionRef.current=recognition;try{recognition.start();notify("بدأ الاستماع للكلمات المختارة")}catch{listeningRequestedRef.current=false;recognitionRef.current=null;notify("تعذر بدء الاستماع الآن")}
  };
  const toggleScreen=async()=>{
    if(screen){screenRef.current?.getTracks().forEach(t=>t.stop());screenRef.current=null;if(screenVideoRef.current)screenVideoRef.current.srcObject=null;setScreen(false);setScreenMonitoring(false);setScreenAlert("");screenPreviousRef.current=null;return}
    try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screenRef.current=stream;stream.getVideoTracks()[0].onended=()=>{setScreen(false);setScreenMonitoring(false);screenRef.current=null};setScreen(true);setScreenMonitoring(true);setScreenAlert("");screenPreviousRef.current=null;notify("تمت المشاركة — ارسم إطار المتابعة داخل المعاينة")}
    catch{notify("لم تبدأ المشاركة — اختر شاشة واسمح بالصلاحية")}
  };
  useEffect(()=>{if(screen&&screenVideoRef.current&&screenRef.current){screenVideoRef.current.srcObject=screenRef.current;screenVideoRef.current.play().catch(()=>{})}},[screen,smartTool]);
  useEffect(()=>{screenPreviousRef.current=null},[screenSelection]);
  useEffect(()=>{if(!screen||!screenMonitoring)return;const sample=()=>{const video=screenVideoRef.current,canvas=screenCanvasRef.current;if(!video||!canvas||video.readyState<2||!video.videoWidth)return;const width=128,height=72;canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;ctx.drawImage(video,0,0,width,height);const image=ctx.getImageData(0,0,width,height).data;const left=Math.floor(width*screenSelection.x/100),top=Math.floor(height*screenSelection.y/100),right=Math.max(left+1,Math.floor(width*(screenSelection.x+screenSelection.w)/100)),bottom=Math.max(top+1,Math.floor(height*(screenSelection.y+screenSelection.h)/100));const values:number[]=[];for(let y=top;y<bottom;y+=2)for(let x=left;x<right;x+=2){const i=(y*width+x)*4;values.push(image[i],image[i+1],image[i+2])}if(!screenPreviousRef.current){screenPreviousRef.current=new Uint8ClampedArray(values);return}let total=0;for(let i=0;i<values.length;i++)total+=Math.abs(values[i]-(screenPreviousRef.current[i]||0));const diff=total/Math.max(1,values.length*2.55);screenPreviousRef.current=new Uint8ClampedArray(values);const now=Date.now();if(diff>=screenSensitivity&&now-screenLastAlertRef.current>2500){screenLastAlertRef.current=now;setScreenAlert(`تغيّر واضح داخل المنطقة المحددة (${Math.round(diff)}٪)`);playAlert("urgent");setToast(`تنبيه متابعة الشاشة: ${Math.round(diff)}٪ تغيّر`);setTimeout(()=>setScreenAlert(""),3200);setTimeout(()=>setToast(""),3200)}};sample();screenMonitorTimerRef.current=setInterval(sample,700);return()=>{if(screenMonitorTimerRef.current)clearInterval(screenMonitorTimerRef.current);screenMonitorTimerRef.current=null}},[screen,screenMonitoring,screenSelection,screenSensitivity]);
  const pointInScreen=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100)),y:Math.max(0,Math.min(100,((event.clientY-rect.top)/rect.height)*100))}};
  const beginScreenDraw=(event:React.PointerEvent<HTMLDivElement>)=>{if((event.target as HTMLElement).closest(".screen-selection"))return;const point=pointInScreen(event);screenDragRef.current={mode:"draw",startX:point.x,startY:point.y,origin:{...screenSelection}};setScreenSelection({x:point.x,y:point.y,w:2,h:2});event.currentTarget.setPointerCapture(event.pointerId)};
  const beginScreenMove=(event:React.PointerEvent<HTMLDivElement>)=>{event.stopPropagation();const point=pointInScreen(event);screenDragRef.current={mode:"move",startX:point.x,startY:point.y,origin:{...screenSelection}};event.currentTarget.setPointerCapture(event.pointerId)};
  const beginScreenResize=(event:React.PointerEvent<HTMLSpanElement>)=>{event.stopPropagation();const rect=event.currentTarget.parentElement?.parentElement;const point=rect?pointInScreen({currentTarget:rect,clientX:event.clientX,clientY:event.clientY} as React.PointerEvent<HTMLDivElement>):{x:0,y:0};screenDragRef.current={mode:"resize",startX:point.x,startY:point.y,origin:{...screenSelection}};event.currentTarget.setPointerCapture(event.pointerId)};
  const updateScreenSelection=(event:React.PointerEvent<HTMLDivElement>)=>{const drag=screenDragRef.current;if(!drag)return;const point=pointInScreen(event);const dx=point.x-drag.startX,dy=point.y-drag.startY;if(drag.mode==="draw"){const x=Math.min(drag.startX,point.x),y=Math.min(drag.startY,point.y);setScreenSelection({x,y,w:Math.max(8,Math.abs(dx)),h:Math.max(8,Math.abs(dy))})}else if(drag.mode==="move"){setScreenSelection({...drag.origin,x:Math.max(0,Math.min(100-drag.origin.w,drag.origin.x+dx)),y:Math.max(0,Math.min(100-drag.origin.h,drag.origin.y+dy))})}else{setScreenSelection({...drag.origin,w:Math.max(12,Math.min(100-drag.origin.x,drag.origin.w+dx)),h:Math.max(12,Math.min(100-drag.origin.y,drag.origin.h+dy))})}};
  const endScreenSelection=(event:React.PointerEvent<HTMLDivElement>)=>{screenDragRef.current=null;try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}};

  const hour=new Date().getHours();const greeting=hour<12?"صباح الخير":hour<18?"مساء الخير":"مساء النور";
  const welcomeQuotes=["خطوة بسيطة اليوم تصنع فرقًا كبيرًا بكرة.","رتّب يومك بهدوء، والإنجاز يتبعك.","كل دقيقة تركيز تقرّبك من هدفك.","ابدأ بخطوة واحدة، والباقي يصير أسهل."];
  const moveWelcomeSwipe=(clientX:number)=>{const track=welcomeTrackRef.current;if(!track)return;const rect=track.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(rect.right-clientX)/(rect.width-72)));setWelcomeSwipe(progress);if(progress>.93){setEntered(true);localStorage.setItem("navixa-entered","1")}};
  useEffect(()=>{if(localStorage.getItem("navixa-entered")==="1")setEntered(true)},[]);
  return <main className={`nx ${entered?"entered":"waiting"}`} dir="rtl">
    {!entered&&<section className="welcome"><div className="welcome-pattern"/><div className="welcome-orb one"/><div className="welcome-orb two"/><div className="navixa-logo-hero"><img src="/navixa-mark.png" alt="شعار NAVIXA" /></div><small>{greeting}</small><h1>يفهم يومك <b>NAVIXA</b></h1><p className="type-welcome">{typedWelcome}<i>|</i></p><blockquote key={quoteIndex}>“{welcomeQuotes[quoteIndex]}”</blockquote><div className="welcome-benefits"><span>◉ متابعة ذكية</span><span>▣ مراقبة محلية</span><span>◎ تركيز وصحة</span></div><div ref={welcomeTrackRef} className="welcome-swipe" onPointerMove={e=>moveWelcomeSwipe(e.clientX)} onPointerUp={()=>setWelcomeSwipe(0)} onPointerLeave={()=>setWelcomeSwipe(0)}><b>اسحب للدخول</b><button aria-label="اسحب شعار NAVIXA من اليمين إلى اليسار" style={{right:`calc(6px + ${welcomeSwipe*100}% - ${welcomeSwipe*76}px)`}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)}}><i/><i/></button><span>←</span></div><em>🔒 لا يعمل الميكروفون أو الشاشة إلا بموافقتك الصريحة</em></section>}
    {toast&&<div className="nx-toast">✓ {toast}</div>}
    <aside className="nx-side">
      <a className="nx-brand" href="#top"><span className="brand-logo"><img src="/navixa-mark.png" alt="" /></span><div><b>NAVIXA</b><small>مساعدك اليومي</small></div></a>
      <nav aria-label="أقسام NAVIXA الرئيسية">
        <a className="active" href="#today"><i>⌂</i> يومي</a>
        <a href="#focus"><i>✓</i> إنتاجيتي <em>{tasks.filter(t=>!t.done).length}</em></a>
        <a href="/health"><i>♡</i> صحتي</a>
        <a href="/worship"><i>﷽</i> عبادتي</a>
        <a href="#assistant"><i>✦</i> المساعد</a>
      </nav>
      <div className="side-quick"><small>أدوات سريعة</small><button onClick={()=>setModal("tasks")}>المهام</button><button onClick={()=>setModal("alerts")}>التنبيهات</button></div>
      <details className="side-sound"><summary>♫ صوت التنبيهات</summary><div>{[["chime","رنين هادئ"],["bell","جرس واضح"],["pulse","نبض سريع"],["urgent","تنبيه مهم"],["silent","بدون صوت"]].map(([value,label])=><label key={value}><input type="radio" name="side-alert-sound" checked={alertSound===value} onChange={()=>setAlertSound(value)}/><span>{label}</span><button type="button" onClick={()=>playAlert(value)}>تجربة</button></label>)}</div></details>
      <a className="nx-user admin-user-entry" href="/admin/login"><span className="side-mark"><img src="/navixa-mark.png" alt="" /></span><div><b>دخول الإدارة</b><small>مركز تحكم NAVIXA</small></div><i>←</i></a>
    </aside>

    <section className="nx-page" id="top">
      <div className="mobile-topbar"><a href="#top" className="mobile-topbar-brand"><img src="/navixa-mark.png" alt="NAVIXA" /><b>NAVIXA</b></a><a href="/admin/login" className="mobile-topbar-admin"><img src="/navixa-mark.png" alt="" /><span>دخول الإدارة</span></a></div>
      <header className="nx-head"><a className="mobile-brand" href="#top"><img src="/navixa-mark.png" alt="NAVIXA" /></a><div><small>يوم جديد · فرصة جديدة</small><h1>{greeting}، وش ودّك تنجز اليوم؟</h1></div><div><button aria-label="التنبيهات" onClick={()=>setModal("alerts")}>♢<i/></button></div></header>
      <PrayerStrip/>

      <section className="navixa-today" id="today" aria-labelledby="today-title">
        <div className="today-heading"><div><small>NAVIXA TODAY</small><h2 id="today-title">أهم ما يحتاج انتباهك اليوم</h2><p>ملخص واحد يجمع يومك قبل ما تنتقل للتفاصيل.</p></div><button onClick={()=>setModal("tasks")}>＋ إضافة مهمة</button></div>
        <div className="today-grid">
          <button onClick={()=>setModal("tasks")}><span className="today-icon green">✓</span><small>المهام</small><b>{tasks.filter(t=>!t.done).length} متبقية</b><em>{tasksDoneCount} مكتملة اليوم</em></button>
          <button onClick={()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"})}><span className="today-icon lavender">◎</span><small>التركيز</small><b>{todaySessions} جلسات</b><em>{running?`${time} متبقية`:"جلسة 25 دقيقة جاهزة"}</em></button>
          <a href="/health"><span className="today-icon rose">♡</span><small>الصحة</small><b>{weekHydrationDays} أيام ترطيب</b><em>راجع الحركة والماء</em></a>
          <a href="/worship"><span className="today-icon sand">﷽</span><small>العبادة</small><b>ورد اليوم</b><em>الصلاة والقرآن والأذكار</em></a>
          <button onClick={()=>setModal("ask")}><span className="today-icon dark">✦</span><small>المساعد</small><b>جاهز لك</b><em>اسأله عن يومك</em></button>
        </div>
      </section>

      <section className="nx-hero showcase">
        <div className="arch one"/><div className="arch two"/><div className="saudi-pattern"/>
        <div className="lavender lavender-a">⚘<br/>⚘<br/>⚘</div><div className="lavender lavender-b">⚘ ⚘</div>
        <aside className="day-board"><div className="board-title"><b>اليوم</b><span>⌄</span></div><article><i>▣</i><p><b>أولويات</b><small>مراجعة أهداف اليوم</small></p></article><article><i>▰</i><p><b>مشاريع</b><small>تقرير أداء المشروع</small></p></article><article><i>♙</i><p><b>اجتماعات</b><small>مراجعة خطة الربع</small></p></article><article><i>✓</i><p><b>مهام</b><small>{tasks.filter(t=>!t.done).length} مهام متبقية</small></p></article></aside>
        <div className="hero-center"><img className="hero-logo-mark" src="/navixa-mark.png" alt="NAVIXA" /><h3>ذكاء يفهم يومك</h3><button className="main-ask" onClick={()=>setModal("ask")}><span>✦</span> كيف يمكنني مساعدتك اليوم؟ <i>↑</i></button><div className="quick-prompts"><button onClick={()=>setModal("ask")}>تخطيط الأسبوع ▦</button><button onClick={()=>setModal("tasks")}>تنظيم المهام ✓</button><button onClick={()=>setModal("ask")}>إعداد عرض ▣</button><button onClick={()=>setModal("ask")}>تلخيص المستندات ▤</button></div></div>
        <div className="smart-note"><small>مساعدك الذكي</small><p>لخّص لي نقاط الاجتماع<br/>واقترح الإجراءات التالية</p><button onClick={()=>setModal("ask")}>✦</button></div>
        <button className="focus-card" onClick={()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"})}><b>تركيز</b><span>{time}</span><small>جلسة تركيز</small><i/></button>
      </section>

      <section className="daily-strip" id="productivity"><div><small>إنجاز اليوم</small><b>72%</b><span><i style={{width:"72%"}}/></span></div><div><small>وقت التركيز</small><b>2س 15د</b><em>↑ 24 دقيقة</em></div><div><small>المهام المكتملة</small><b>{tasks.filter(t=>t.done).length} / {tasks.length}</b><em>ممتاز، كمّل</em></div><div><small>موعدك القادم</small><b>09:30</b><em>بعد 35 دقيقة</em></div></section>

      <section className="insights-grid">
        <DailyReviewCard sessionsToday={todaySessions} tasksDone={tasksDoneCount} tasksTotal={tasks.length} bestHour={bestHour} onLogSession={logSession} onQuickTask={quickTask}/>
        <WeeklyChallengeCard weekSessions={weekSessionsTotal} weekHydrationDays={weekHydrationDays} tasksDone={tasksDoneCount}/>
        <BehaviorAnalysisCard weekly={weeklySessions} sessionHours={sessionHours}/>
      </section>

      <section className="nx-section" id="assistant"><div className="section-head"><div><small>مساعدك الذكي</small><h2>كل ما تحتاجه ليوم أوضح</h2><p>أدوات مرنة تساعدك في العمل والمشاريع والمواعيد والحياة اليومية.</p></div></div>
<div className="assistant-tool-strip" aria-label="أدوات مساعدك الذكي">
          <button className="assistant-tool-card selected" onClick={()=>setSmartTool("listener")}><span className="assistant-tool-icon tool-mic">◉</span><small>استماع ذكي</small><b>الكلمات المهمة</b><em>{listening?"يستمع الآن":"جاهز"}</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("screen")}><span className="assistant-tool-icon tool-screen">▣</span><small>متابعة الشاشة</small><b>مشاركة محلية</b><em>{screen?"مفعّلة":"تجريبية"}</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("tasks")}><span className="assistant-tool-icon tool-tasks">☑</span><small>تنظيم</small><b>مهام ومواعيد</b><em>{tasks.filter(t=>!t.done).length} متبقية</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("summary")}><span className="assistant-tool-icon tool-summary">✦</span><small>ذكاء عملي</small><b>تلخيص سريع</b><em>ابدأ الآن</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("links")}><span className="assistant-tool-icon tool-links">⌁</span><small>في مكان واحد</small><b>روابطك المهمة</b><em>التقويم والأدوات</em></button>
        </div>
      </section>

      <section className="health-gateway"><div><span>♡</span><div><small>مركز NAVIXA الصحي</small><h2>جلستك، حركتك وماءك في صفحة واحدة</h2><p>مراقبة محلية للجلوس، تمارين سريعة وتذكيرات واضحة.</p></div></div><a href="/health">فتح صحتي ←</a></section>
      <section className="worship-gateway"><div><span>﷽</span><div><small>مركز NAVIXA للورد اليومي</small><h2>مواقيت الصلاة، الأذكار وورد القرآن</h2><p>ورد يومي بسيط يدخل ضمن إنجازاتك وتقاريرك.</p></div></div><a href="/worship">فتح الورد اليومي ←</a></section>
      <section className="focus-zone" id="focus"><div><small>جلسة تركيز</small><h2>خذ وقتك. خلّ الباقي علينا.</h2><p>مؤقت بسيط يساعدك تنجز بعيدًا عن التشتت.</p><div className="focus-actions"><button onClick={()=>setRunning(!running)}>{running?"إيقاف مؤقت":"ابدأ 25 دقيقة"}</button><button className="ghost" onClick={()=>{setRunning(false);setSeconds(25*60)}}>إعادة</button></div></div><div className={`timer ${running?"running":""}`}><span>{time}</span><small>{running?"أنت الآن في وضع التركيز":"جاهز متى ما كنت"}</small><FocusTasbihNudge running={running}/></div><div className="lavender-stem">✦</div></section>

      <section className="nx-section automation" id="automations"><div className="section-head"><div><small>الأتمتة</small><h2>NAVIXA يختصر الخطوات عنك</h2><p>قواعد بسيطة تتكرر تلقائيًا في وقتها.</p></div><button onClick={()=>setModal("automation")}>＋ أتمتة جديدة</button></div><div className="automation-list">{automations.map((x,i)=><article key={`${x.name}-${i}`}><span>{x.icon}</span><div><b>{x.name}</b><small>{x.when}</small></div><p>{x.action}</p><label><input aria-label={`تفعيل ${x.name}`} type="checkbox" checked={x.on} onChange={()=>setAutomations(automations.map((a,j)=>j===i?{...a,on:!a.on}:a))}/><i/></label></article>)}</div></section>

      <section className="proof-grid"><article><span>♙</span><b>12.8K+</b><small>مستخدم نشط في NAVIXA</small></article><article><span>◷</span><b>85,000+</b><small>ساعة إنتاجية مسجلة</small></article><article><span>☆</span><b>4.9/5</b><small>تقييم المستخدمين</small></article><article><span>♢</span><b>100%</b><small>خصوصية — بياناتك على جهازك</small></article></section>
      <section className="faq"><h2>🛡️ دليل الثقة والاستخدام الذكي</h2>{[["هل NAVIXA آمن لبياناتي؟","نعم. لا يبدأ الميكروفون أو مشاركة الشاشة إلا بعد ضغطك وموافقتك على صلاحية المتصفح."],["هل تُرفع الشاشة أو التسجيلات إلى الموقع؟","لا. المعالجة تتم داخل جلسة المتصفح ولا يحفظ الموقع صورة الشاشة أو التسجيل الصوتي."],["هل يعمل أثناء الاجتماعات الحضورية والأونلاين؟","نعم، عند تفعيل الاستماع يمكنه رصد الكلمات التي تختارها من الصوت الذي تسمح به للمتصفح."],["هل أحتاج لتسجيل حساب؟","لاستخدام الصفحة اليومية لا، أما لوحة الإدارة فلها صفحة دخول مستقلة."],["كيف يكتشف المعلومات تلقائيًا؟","من الصلاحيات التي تمنحها أنت فقط، ومن الأتمتة التي تنشئها وتفعّلها."],["كيف أوقف الصلاحيات؟","اضغط إيقاف داخل البطاقة أو استخدم مؤشر المشاركة في المتصفح لإيقافها فورًا."],["هل يمكنني إضافة أكثر من اسم؟","نعم، اكتب الأسماء أو الكلمات وافصلها بفاصلة، ولن تؤثر المسافات أو علامات الترقيم."],["هل يعمل بالعربي والإنجليزي؟","الواجهة عربية حاليًا، ويمكن توسيع الاستماع والواجهة للغات إضافية."]].map(x=><details key={x[0]}><summary>{x[0]}<span>⌄</span></summary><p>{x[1]}</p></details>)}</section>
      <section className="contact"><div className="contact-heading"><span className="contact-kicker">NAVIXA COMMUNITY</span><h2>تواصل معنا</h2><p>تابعنا على حساباتنا الرسمية</p></div><div className="contact-links"><a className="contact-link email" href="mailto:hello@navixa.sa" aria-label="البريد الإلكتروني"><span>✉</span><b>البريد</b></a><a className="contact-link x" href={social.x} target="_blank" rel="noreferrer" aria-label="منصة X"><span>𝕏</span><b>منصة X</b></a><a className="contact-link instagram" href={social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><span>◎</span><b>Instagram</b></a><a className="contact-link youtube" href={social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><span>▶</span><b>YouTube</b></a></div></section>

      <footer><div className="nx-brand"><img src="/navixa-mark.png" alt="NAVIXA" /><div><b>NAVIXA</b><small>ذكاء يفهم يومك</small></div></div><p>مصمم لحياة أكثر ترتيبًا للجميع.</p><div className="counters">{showCounter&&<div className="visit-counter"><small>زوار الموقع</small><b>{visitCount.toLocaleString("en-US")}</b></div>}<div className="ehsan-counter"><small>زيارات منصة إحسان</small><b>{ehsanCount.toLocaleString("en-US")}</b></div></div><span>© 2026 NAVIXA</span></footer>
    </section>

    {smartTool&&<div className="assistant-tool-modal-back" onClick={()=>setSmartTool(null)}><section className="assistant-tool-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSmartTool(null)}>×</button>{smartTool==="listener"&&<><small>استماع ذكي</small><h2>الأسماء والكلمات المهمة</h2><p>اكتب الكلمات التي تريد متابعتها. المعالجة داخل المتصفح ولا يبدأ الميكروفون إلا بعد موافقتك.</p><input aria-label="الأسماء والكلمات" value={watchTerms} onChange={e=>{setWatchTerms(e.target.value);watchTermsRef.current=e.target.value}} placeholder="اسم أو كلمة، موعد، إجراء مهم"/><div className="assistant-heard-preview"><small>ما يسمعه NAVIXA الآن</small><p>{[heardText,interimText].filter(Boolean).join(" ")||"سيظهر النص هنا بعد تشغيل الاستماع"}</p>{heardMatch&&<strong>آخر اسم تم التقاطه: {heardMatch}</strong>}</div><div className="assistant-tool-actions"><button onClick={toggleListening}>{listening?"إيقاف الاستماع":"تشغيل الاستماع"}</button><button className="ghost" onClick={()=>{setHeardText("");setInterimText("")}}>مسح النص</button></div></>}{smartTool==="screen"&&<><small>متابعة الشاشة</small><h2>{screen?"ارسم منطقة المتابعة":"شارك ثم حدّد المنطقة"}</h2><p>تظهر المعاينة داخل المتصفح فقط؛ لا يتم حفظ صورة الشاشة أو رفعها. ارسم إطارًا حرًا ثم حرّكه أو غيّر حجمه متى شئت.</p>{screen&&<div className="screen-preview-shell"><video ref={screenVideoRef} className="screen-preview-video" autoPlay muted playsInline/><canvas ref={screenCanvasRef} className="screen-analysis-canvas" aria-hidden="true"/><div className="screen-preview-overlay" onPointerDown={beginScreenDraw} onPointerMove={updateScreenSelection} onPointerUp={endScreenSelection} onPointerCancel={endScreenSelection}><div className="screen-selection" style={{left:`${screenSelection.x}%`,top:`${screenSelection.y}%`,width:`${screenSelection.w}%`,height:`${screenSelection.h}%`}} onPointerDown={beginScreenMove}><span>منطقة المتابعة</span><i onPointerDown={beginScreenResize}/></div><small>اسحب لرسم إطار جديد · اسحب الإطار لتحريكه</small></div></div>}{screen&&<div className={`screen-monitor-status ${screenAlert?"screen-alert-active":""}`}><b>{screenAlert||`المراقبة المحلية ${screenMonitoring?"مفعّلة":"متوقفة"}`}</b><label><input type="checkbox" checked={screenMonitoring} onChange={e=>{setScreenMonitoring(e.target.checked);screenPreviousRef.current=null}}/> تنبيه عند التغيّر</label><label>الحساسية <input type="range" min="5" max="35" value={screenSensitivity} onChange={e=>{setScreenSensitivity(Number(e.target.value));screenPreviousRef.current=null}}/></label><small>كلما زادت الحساسية التقط تغييرات أصغر داخل الإطار.</small></div>}<button className="assistant-primary-action" onClick={toggleScreen}>{screen?"إيقاف المشاركة":"اختيار شاشة"}</button></>}{smartTool==="tasks"&&<><small>تنظيم يومك</small><h2>مهام ومواعيد</h2><p>افتح لوحة المهام لإضافة موعد أو مهمة ومتابعة الإنجاز.</p><button className="assistant-primary-action" onClick={()=>{setSmartTool(null);setModal("tasks")}}>فتح المهام</button></>}{smartTool==="summary"&&<><small>ذكاء عملي</small><h2>تلخيص سريع</h2><p>أرسل طلبك إلى NAVIXA ليحوّل النص أو الاجتماع إلى نقاط وإجراءات واضحة.</p><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلب التلخيص إلى NAVIXA");setSmartTool(null)}}><textarea required placeholder="الصق النص أو اكتب ما تريد تلخيصه..."/><button className="assistant-primary-action">إرسال للتلخيص</button></form></>}{smartTool==="links"&&<><small>في مكان واحد</small><h2>روابطك المهمة</h2><p>افتح أدواتك اليومية بسرعة من واجهة NAVIXA.</p><a className="assistant-primary-action assistant-link-action" href="https://calendar.google.com" target="_blank" rel="noreferrer">فتح التقويم ↗</a></>}</section></div>}
    {modal&&<div className="nx-modal-back" onClick={()=>setModal(null)}><section className="nx-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button>{modal==="tasks"?<><small>مهامي</small><h2>خلّ يومك واضح</h2><div className="task-list">{tasks.map((t,i)=><label key={`${t.title}-${i}`}><input type="checkbox" checked={t.done} onChange={()=>{if(!t.done)sendTelegramAlert("task",`✅ تذكير NAVIXA: تم إنجاز مهمة — ${t.title}`);setTasks(tasks.map((x,j)=>j===i?{...x,done:!x.done}:x))}}/><span className={t.done?"done":""}>{t.title}</span><button onClick={()=>setTasks(tasks.filter((_,j)=>j!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);setTasks([...tasks,{title:String(data.get("task")),done:false}]);e.currentTarget.reset()}}><input name="task" required placeholder="أضف مهمة جديدة..."/><button>إضافة</button></form></>:modal==="automation"?<><small>أتمتة جديدة</small><h2>أنشئ قاعدة تتكرر تلقائيًا</h2><form className="stack-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);setAutomations([...automations,{icon:"✦",name:String(d.get("name")),when:String(d.get("when")),action:String(d.get("action")),on:true}]);setModal(null);notify("تمت إضافة الأتمتة وتشغيلها")}}><input name="name" required placeholder="اسم الأتمتة"/><input name="when" required placeholder="متى تعمل؟ مثال: كل يوم 8 صباحًا"/><input name="action" required placeholder="ماذا تنفذ؟"/><button>حفظ وتشغيل</button></form></>:modal==="alerts"?<><small>مركز التنبيهات</small><h2>كل تنبيهاتك في مكان واحد</h2>
      <NotificationCenter/></>:<><small>مساعد NAVIXA</small><h2>وش أقدر أسوي لك يا سلطان؟</h2><div className="suggestions"><button onClick={()=>notify("جهزت لك خطة يوم متوازنة")}>رتّب يومي</button><button onClick={()=>notify("أرسل النص وسألخصه لك")}>لخّص لي</button><button onClick={()=>notify("بدأ تجهيز قائمة الأولويات")}>حدّد أولوياتي</button></div><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلبك إلى NAVIXA");setModal(null)}}><input required placeholder="اكتب طلبك هنا..."/><button>إرسال</button></form></>}</section></div>}
    <FloatingAssistant onAddTask={title=>{setTasks(current=>[...current,{title,done:false,meta:"استنتجها مساعد NAVIXA"}]);setModal("tasks");notify("تمت إضافة المطلوب للمهام")}}/>
    <GameAdBox/>
    <HealthNudge/>
  </main>
}
