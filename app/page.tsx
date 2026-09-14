"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ar } from "./content/ar";
import { arCta } from "./content/cta/ar";
import { arMessages } from "./content/messages/ar";
import { languageIdentity } from "./content/languages";
import "./navixa.css";
import "./welcome.css";
import "./counter-extra.css";
import "./insights.css";
import "./member-platform-ribbon.css";
import OnboardingGuide from "./onboarding/OnboardingGuide";
import DailyReviewCard from "./DailyReviewCard";
import WeeklyChallengeCard from "./WeeklyChallengeCard";
import FocusTasbihNudge from "./FocusTasbihNudge";
import PrayerStrip from "./PrayerStrip";
import AppearanceSettings from "./AppearanceSettings";
import FeatureAccessGate from "./FeatureAccessGate";
import {isScreenEnabled,sendTelegramAlert} from "./alertPrefs";
import { captureAcademicDate, type AcademicCapture } from "./academicCapture";
import { readAcademicReminders, type AcademicReminder } from "./academicReminders";
import type { PublicRuntimeFeatures } from "./runtimeFeatures";
import { createNavixaBrowserVoiceEngine, type NavixaVoiceEngine } from "./voice/voiceEngine";
import { findNavixaVoiceTerm, splitNavixaVoiceTerms } from "./voice/voiceDetection";

const FloatingAssistant = dynamic(() => import("./FloatingAssistant"), { ssr: false });
const GameAdBox = dynamic(() => import("./GameAdBox"), { ssr: false });
const HealthNudge = dynamic(() => import("./HealthNudge"), { ssr: false });
const NotificationCenter = dynamic(() => import("./NotificationCenter"), { ssr: false });
const PersonalReminderEngine = dynamic(() => import("./PersonalReminderEngine"), { ssr: false });
const MemberPlatformRibbon = dynamic(() => import("./MemberPlatformRibbon"), { ssr: false });
const HomeVideoModal = dynamic(() => import("./home-performance/HomeVideoModal"), { ssr: false });
const HomeWelcome = dynamic(() => import("./home-performance/HomeWelcome"), { ssr: false });

const DEFAULT_RUNTIME_FEATURES:PublicRuntimeFeatures={floatingAssistantEnabled:false,gameAdEnabled:false,healthNudgeEnabled:false,memberPlatformRibbonEnabled:false,matchesHomeEnabled:false,usageAnalyticsEnabled:false,publicCounterEnabled:false};

type Task={title:string;done:boolean;meta?:string};
type SmartTool="listener"|"screen"|"tasks"|"summary"|"links";
type HomeModal="tasks"|"ask"|"automation"|"screen"|"alerts"|"backup"|"appearance";
type AppearanceMode="light"|"dark"|"system";
type AppearancePalette="oasis"|"lilac"|"midnight"|"sand";
type TextScale="default"|"large"|"xlarge";
type TutorialKey="listener"|"screen"|"meeting";
type SavedLink={id:string;title:string;url:string;description:string;icon:string};
// صياغة ديناميكية: الاسم يأتي من حدث الاستماع الفعلي، وليس من قاموس النصوص الثابتة.
const listenerHeardTitle=(name:string)=>arMessages.smartListening.detectedName(name);
const starters:Task[]=[];
const today=()=>new Date().toISOString().slice(0,10);
const FOCUS_PRESETS=[15,25,45,60];
const DEFAULT_FOCUS_DURATION=25*60;
const computeBestHour=(hours:string[])=>{const counts:Record<number,number>={};hours.forEach(iso=>{const h=new Date(iso).getHours();counts[h]=(counts[h]||0)+1});const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return top?`${top[0]}:00`:null};

type FocusTimerProps={time:string;progress:number;running:boolean;status:string;className?:string};
function FocusTimer({time,progress,running,status,className=""}:FocusTimerProps){
  const value=Math.max(0,Math.min(1,progress)),dashOffset=100-(value*100),angle=(value*360)-90,radians=angle*Math.PI/180;
  const handX=50+(40*Math.cos(radians)),handY=50+(40*Math.sin(radians));
  return <div className={`timer focus-svg-timer ${running?"running":""} ${className}`} role="timer" aria-label={`الوقت المتبقي ${time}`}>
    <svg className="focus-timer-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs><linearGradient id="focus-ring-gradient" x1="8%" y1="92%" x2="92%" y2="8%"><stop offset="0%" stopColor="#70e5d7"/><stop offset="55%" stopColor="#c2b2ff"/><stop offset="100%" stopColor="#fff3ff"/></linearGradient></defs>
      <circle className="focus-ring-track" cx="50" cy="50" r="44" pathLength="100"/>
      {Array.from({length:60},(_,index)=>{const minute=index%5===0,hour=index%15===0;const y1=hour?5.5:minute?7.2:8.4,y2=hour?13.5:minute?11.8:10.4;return <line key={index} className={`focus-ring-tick ${hour?"hour":minute?"minute":"second"}`} x1="50" y1={y1} x2="50" y2={y2} transform={`rotate(${index*6} 50 50)`}/>})}
      <circle className="focus-ring-progress" cx="50" cy="50" r="44" pathLength="100" strokeDasharray="100" strokeDashoffset={dashOffset} transform="rotate(-90 50 50)"/>
      <circle className="focus-ring-head-glow" cx={handX} cy={handY} r="5"/><circle className="focus-ring-head" cx={handX} cy={handY} r="2.7"/>
    </svg>
    <div className="focus-timer-content"><span>{time}</span><small>{status}</small></div>
  </div>
}

type SocialLinks={x:string;instagram:string;youtube:string;github:string};
const SOCIAL_DEFAULTS:SocialLinks={x:"",instagram:"https://www.instagram.com/navixasa/",youtube:"",github:""};
const socialUrl=(value:unknown)=>typeof value==="string"&&/^https:\/\//.test(value.trim())?value.trim():"";
const cleanSocialLinks=(value:unknown):SocialLinks=>{const input=value&&typeof value==="object"?value as Partial<SocialLinks>:{};const x=socialUrl(input.x);const instagram=socialUrl(input.instagram);const youtube=socialUrl(input.youtube);const github=socialUrl(input.github);return {x:x==="https://x.com"||x==="https://x.com/"?"":x,instagram:instagram==="https://instagram.com"||instagram==="https://instagram.com/"?SOCIAL_DEFAULTS.instagram:instagram||SOCIAL_DEFAULTS.instagram,youtube:youtube==="https://youtube.com"||youtube==="https://youtube.com/"?"":youtube,github:github==="https://github.com"||github==="https://github.com/"?"":github}};
const greetingForHour=(hour:number)=>hour<12?"صباح الخير":hour<18?"مساء الخير":"مساء النور";

export default function Home(){
  const [tasks,setTasks]=useState<Task[]>(starters);
  const [ready,setReady]=useState(false);
  const [backgroundToolsReady,setBackgroundToolsReady]=useState(false);
  const [runtimeFeatures,setRuntimeFeatures]=useState<PublicRuntimeFeatures>(DEFAULT_RUNTIME_FEATURES);
  const [assistantOpenRequest,setAssistantOpenRequest]=useState(0);
  const [focusDuration,setFocusDuration]=useState(DEFAULT_FOCUS_DURATION);
  const [focusMinutesInput,setFocusMinutesInput]=useState("25");
  const [seconds,setSeconds]=useState(DEFAULT_FOCUS_DURATION);
  const [focusProgress,setFocusProgress]=useState(0);
  const [running,setRunning]=useState(false);
  const [focusMode,setFocusMode]=useState(false);
  const [listening,setListening]=useState(false);
  const [screen,setScreen]=useState(false);
  const [entered,setEntered]=useState(false);
  const [hideWelcomeForever,setHideWelcomeForever]=useState(false);
  const [welcomePreferenceReady,setWelcomePreferenceReady]=useState(false);
  const [overviewVideoOpen,setOverviewVideoOpen]=useState(false);

  const [watchTerms,setWatchTerms]=useState("");
  const [heardText,setHeardText]=useState("");
  const [interimText,setInterimText]=useState("");
  const [heardMatch,setHeardMatch]=useState("");
  const [academicSuggestion,setAcademicSuggestion]=useState<AcademicCapture|null>(null);
  const [alertSound,setAlertSound]=useState("chime");

  const [visitCount,setVisitCount]=useState(0);
  const [showCounter,setShowCounter]=useState(true);
  const [statsConfigured,setStatsConfigured]=useState(false);
  const [social,setSocial]=useState<SocialLinks>(SOCIAL_DEFAULTS);
  const [savedLinks,setSavedLinks]=useState<SavedLink[]>([]);
  const [automations,setAutomations]=useState<{icon:string;name:string;when:string;action:string;on:boolean}[]>([]);
  const [toast,setToast]=useState("");
  const [smartTool,setSmartTool]=useState<SmartTool|null>(null);
  const [screenSelection,setScreenSelection]=useState({x:18,y:18,w:64,h:54});
  const [screenMonitoring,setScreenMonitoring]=useState(true);
  const [screenSensitivity,setScreenSensitivity]=useState(18);
  const [screenAlert,setScreenAlert]=useState("");
  const [screenOcr,setScreenOcr]=useState(false);
  const [screenOcrText,setScreenOcrText]=useState("");
  const [screenOcrTerms,setScreenOcrTerms]=useState("");
  const [screenOcrSupported,setScreenOcrSupported]=useState(false);
  const [modal,setModal]=useState<HomeModal|null>(null);
  const [showMore,setShowMore]=useState(false);
  const [mobileMoreOpen,setMobileMoreOpen]=useState(false);
  const [appearanceMode,setAppearanceMode]=useState<AppearanceMode>("system");
  const [appearancePalette,setAppearancePalette]=useState<AppearancePalette>("oasis");
  const [textScale,setTextScale]=useState<TextScale>("default");
  const [highContrast,setHighContrast]=useState(false);
  const [appearanceReady,setAppearanceReady]=useState(false);
  const [tutorialOpen,setTutorialOpen]=useState<TutorialKey|null>(null);
  const [tutorialHidden,setTutorialHidden]=useState<Record<TutorialKey,boolean>>({listener:false,screen:false,meeting:false});
  const [greetingVisible,setGreetingVisible]=useState(true);
  const [greeting,setGreeting]=useState("أهلًا");
  const voiceEngineRef=useRef<NavixaVoiceEngine|null>(null);
  const listeningRequestedRef=useRef(false);
  const watchTermsRef=useRef("");
  const screenRef=useRef<MediaStream|null>(null);
  const screenVideoRef=useRef<HTMLVideoElement>(null);
  const screenCanvasRef=useRef<HTMLCanvasElement>(null);
  const screenPreviousRef=useRef<Uint8ClampedArray|null>(null);
  const screenMonitorTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const screenLastAlertRef=useRef(0);
  const screenOcrTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const screenOcrWorkerRef=useRef<any>(null);
  const screenDragRef=useRef<{mode:"draw"|"move"|"resize";startX:number;startY:number;origin:{x:number;y:number;w:number;h:number}}|null>(null);
  const lastIntentRef=useRef("");
  const lastNameAlertRef=useRef({name:"",at:0});
  const backupInputRef=useRef<HTMLInputElement>(null);
  const focusDeadlineRef=useRef<number|null>(null);
  const playAlert=(sound=alertSound)=>{if(sound==="silent")return;try{const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;const ctx=new AudioCtx();const patterns:Record<string,number[]>={chime:[659,880],bell:[784,659,784],pulse:[440,440,660],urgent:[880,660,880,660]};const notes=patterns[sound]||patterns.chime;notes.forEach((frequency,index)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();const start=ctx.currentTime+index*.18;oscillator.type=sound==="urgent"?"square":"sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(sound==="urgent"?.13:.2,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.18)});setTimeout(()=>ctx.close(),notes.length*180+300)}catch{}}
  const notify=(message:string)=>{playAlert();setToast(message);setTimeout(()=>setToast(""),2200)};
  const gentleReminder=(message:string)=>{setToast(message);setTimeout(()=>setToast(""),5200)};
  const backupKeys=()=>Object.keys(localStorage).filter(key=>key.startsWith("navixa-")||key.startsWith("navixa_"));
  const exportData=()=>{const data=Object.fromEntries(backupKeys().map(key=>[key,localStorage.getItem(key)]));const blob=new Blob([JSON.stringify({format:"NAVIXA_LOCAL_BACKUP",version:1,createdAt:new Date().toISOString(),data},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`navixa-backup-${today()}.json`;anchor.click();URL.revokeObjectURL(url);notify("تم تصدير بياناتك إلى ملف آمن")};
  const importData=(file:File)=>{const reader=new FileReader();reader.onload=()=>{try{const backup=JSON.parse(String(reader.result));if(backup?.format!=="NAVIXA_LOCAL_BACKUP"||!backup.data)throw new Error("invalid");Object.entries(backup.data).forEach(([key,value])=>{if(key.startsWith("navixa-")||key.startsWith("navixa_"))localStorage.setItem(key,String(value??""))});notify("تم استيراد البيانات — سيُعاد تحميل الصفحة");setTimeout(()=>window.location.reload(),700)}catch{notify("ملف النسخة الاحتياطية غير صالح")}};reader.readAsText(file)};
  const [insightsTick,setInsightsTick]=useState(0);
  const logSession=()=>{const key=`navixa-sessions-${today()}`;const next=Number(localStorage.getItem(key)||0)+1;localStorage.setItem(key,String(next));const hours=JSON.parse(localStorage.getItem("navixa-session-hours")||"[]");hours.push(new Date().toISOString());localStorage.setItem("navixa-session-hours",JSON.stringify(hours.slice(-300)));setInsightsTick(t=>t+1)};
  const quickTask=()=>{setTasks(current=>[...current,{title:"مهمة سريعة",done:false,meta:"من مراجعة اليوم"}]);notify("تمت إضافة مهمة سريعة")};
  const normalizeName=(value:string)=>value.normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase();
  const splitWatchTerms=(value:string)=>value.split(/[،,;؛.!؟:|/\\\n]+/).flatMap(part=>part.trim().split(/\s+/)).map(normalizeName).filter(Boolean);
  const alertName=(name:string)=>{const now=Date.now();setHeardMatch(name);if(lastNameAlertRef.current.name===name&&now-lastNameAlertRef.current.at<15000)return;lastNameAlertRef.current={name,at:now};if(isScreenEnabled("name")){playAlert("urgent");setToast(`تنبيه: سمعنا الاسم (${name})`);setTimeout(()=>setToast(""),3500)}sendTelegramAlert("name",`تنبيه NAVIXA: تم سماع الاسم (${name})`)};
  const dismissGreeting=()=>{sessionStorage.setItem("navixa-greeting-hidden-session","1");setGreetingVisible(false)};
  useEffect(()=>{const savedTutorials=localStorage.getItem("navixa-tutorials-hidden");if(savedTutorials){try{const parsed=JSON.parse(savedTutorials);setTutorialHidden({listener:Boolean(parsed.listener),screen:Boolean(parsed.screen),meeting:Boolean(parsed.meeting)})}catch{}}const saved=localStorage.getItem("navixa-life-tasks");const savedSocial=localStorage.getItem("navixa-social");const savedFocusMinutes=Number(localStorage.getItem("navixa-focus-duration-minutes")||25);if(Number.isFinite(savedFocusMinutes)&&savedFocusMinutes>=1&&savedFocusMinutes<=480){const savedDuration=Math.round(savedFocusMinutes)*60;setFocusDuration(savedDuration);setFocusMinutesInput(String(Math.round(savedFocusMinutes)));setSeconds(savedDuration)}const savedSound=localStorage.getItem("navixa-alert-sound");const savedTerms=localStorage.getItem("navixa-watch-terms");const savedLinksValue=localStorage.getItem("navixa-saved-links");const savedAutomations=localStorage.getItem("navixa-automations");const savedScreenSensitivity=localStorage.getItem("navixa-screen-sensitivity");if(saved)setTasks(JSON.parse(saved));if(savedSocial){try{setSocial(cleanSocialLinks(JSON.parse(savedSocial)))}catch{setSocial(SOCIAL_DEFAULTS)}}if(savedSound)setAlertSound(savedSound);if(savedTerms){setWatchTerms(savedTerms);watchTermsRef.current=savedTerms}if(savedLinksValue){try{setSavedLinks(JSON.parse(savedLinksValue))}catch{setSavedLinks([])}}if(savedAutomations){try{setAutomations(JSON.parse(savedAutomations))}catch{}}if(savedScreenSensitivity)setScreenSensitivity(Number(savedScreenSensitivity));setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-alert-sound",alertSound)},[alertSound,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-life-tasks",JSON.stringify(tasks))},[tasks,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-watch-terms",watchTerms)},[watchTerms,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-saved-links",JSON.stringify(savedLinks))},[savedLinks,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-automations",JSON.stringify(automations))},[automations,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-social",JSON.stringify(social))},[social,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-screen-sensitivity",String(screenSensitivity))},[screenSensitivity,ready]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-focus-duration-minutes",String(Math.round(focusDuration/60)))},[focusDuration,ready]);
  useEffect(()=>{const savedMode=localStorage.getItem("navixa-appearance-mode");const savedPalette=localStorage.getItem("navixa-appearance-palette");const savedScale=localStorage.getItem("navixa-text-scale");if(savedMode==="light"||savedMode==="dark"||savedMode==="system")setAppearanceMode(savedMode);if(savedPalette==="oasis"||savedPalette==="lilac"||savedPalette==="midnight"||savedPalette==="sand")setAppearancePalette(savedPalette);if(savedScale==="default"||savedScale==="large"||savedScale==="xlarge")setTextScale(savedScale);setHighContrast(localStorage.getItem("navixa-high-contrast")==="1");setAppearanceReady(true)},[]);
  useEffect(()=>{if(!appearanceReady)return;const root=document.documentElement;const media=window.matchMedia("(prefers-color-scheme: dark)");const apply=()=>{const resolved=appearanceMode==="system"?(media.matches?"dark":"light"):appearanceMode;root.dataset.navixaTheme=resolved;root.dataset.navixaPalette=appearancePalette;root.dataset.navixaText=textScale;root.dataset.navixaContrast=highContrast?"high":"normal";root.style.colorScheme=resolved};apply();if(appearanceMode==="system"){media.addEventListener("change",apply);return()=>media.removeEventListener("change",apply)}},[appearanceMode,appearancePalette,textScale,highContrast,appearanceReady]);
  useEffect(()=>{if(!appearanceReady)return;localStorage.setItem("navixa-appearance-mode",appearanceMode);localStorage.setItem("navixa-appearance-palette",appearancePalette);localStorage.setItem("navixa-text-scale",textScale);localStorage.setItem("navixa-high-contrast",highContrast?"1":"0")},[appearanceMode,appearancePalette,textScale,highContrast,appearanceReady]);
  useEffect(()=>{if(ready)localStorage.setItem("navixa-tutorials-hidden",JSON.stringify(tutorialHidden))},[tutorialHidden,ready]);
  const hideTutorial=(key:TutorialKey)=>{setTutorialHidden(current=>({...current,[key]:true}));setTutorialOpen(null);notify("لن يظهر هذا الشرح تلقائيًا مرة أخرى")};
  const restoreTutorial=(key:TutorialKey)=>setTutorialHidden(current=>({...current,[key]:false}));
  useEffect(()=>()=>{listeningRequestedRef.current=false;voiceEngineRef.current?.destroy();voiceEngineRef.current=null},[]);
  useEffect(()=>{const merge=(items:AcademicReminder[])=>setTasks(current=>{const additions=items.filter(item=>!current.some(task=>task.meta===`تذكير أكاديمي · ${item.id}`)).map(item=>({title:item.title,done:false,meta:`تذكير أكاديمي · ${item.id}`}));return additions.length?[...current,...additions]:current});merge(readAcademicReminders());const onReminder=(event:Event)=>merge([(event as CustomEvent<AcademicReminder>).detail]);window.addEventListener("navixa:academic-reminder",onReminder);return()=>window.removeEventListener("navixa:academic-reminder",onReminder)},[]);
  useEffect(()=>{const settings=JSON.parse(localStorage.getItem("navixa-counter-settings")||'{"enabled":true,"start":0}');setShowCounter(settings.enabled!==false);const next=Number(localStorage.getItem("navixa-visit-count")||settings.start||0)+1;localStorage.setItem("navixa-visit-count",String(next));setVisitCount(next)},[]);
  useEffect(()=>{if(!runtimeFeatures.publicCounterEnabled){setStatsConfigured(false);return}const stored=localStorage.getItem("navixa-stats-visitor-key");const visitorKey=stored||((crypto as any).randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`);if(!stored)localStorage.setItem("navixa-stats-visitor-key",visitorKey);fetch("/api/stats",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:"visit",visitorKey})}).then(response=>response.json()).then(data=>{if(data?.configured&&data?.stats){setVisitCount(Number(data.stats.visits)||0);setStatsConfigured(true)}else setStatsConfigured(false)}).catch(()=>setStatsConfigured(false));},[runtimeFeatures.publicCounterEnabled]);
  const endFocusMode=()=>{const remaining=Math.max(0,(focusDeadlineRef.current??Date.now())-Date.now());focusDeadlineRef.current=null;setSeconds(Math.ceil(remaining/1000));setFocusProgress(Math.max(0,Math.min(1,(focusDuration*1000-remaining)/(focusDuration*1000))));setRunning(false);setFocusMode(false);if(typeof document!=="undefined"&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{})};
  const applyFocusDuration=(value:number)=>{const minutes=Math.max(1,Math.min(480,Math.round(value)));const duration=minutes*60;focusDeadlineRef.current=null;setRunning(false);setFocusMode(false);setFocusDuration(duration);setFocusMinutesInput(String(minutes));setSeconds(duration);setFocusProgress(0);if(typeof document!=="undefined"&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{})};
  const resetFocusSession=()=>{focusDeadlineRef.current=null;setRunning(false);setFocusMode(false);setSeconds(focusDuration);setFocusProgress(0);if(typeof document!=="undefined"&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{})};
  const beginFocusMode=()=>{focusDeadlineRef.current=Date.now()+(seconds*1000);setRunning(true);setFocusMode(true);if(typeof document!=="undefined"&&document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>{})};
  useEffect(()=>{const onChange=()=>{if(typeof document!=="undefined"&&!document.fullscreenElement)setFocusMode(false)};document.addEventListener("fullscreenchange",onChange);return()=>document.removeEventListener("fullscreenchange",onChange)},[]);
  useEffect(()=>{if(!running)return;const deadline=focusDeadlineRef.current??(Date.now()+(seconds*1000));focusDeadlineRef.current=deadline;let frame=0;const tick=()=>{const remaining=Math.max(0,deadline-Date.now()),nextSeconds=Math.ceil(remaining/1000),nextProgress=Math.max(0,Math.min(1,(focusDuration*1000-remaining)/(focusDuration*1000)));setSeconds(current=>current===nextSeconds?current:nextSeconds);setFocusProgress(nextProgress);if(remaining<=0){focusDeadlineRef.current=null;setRunning(false);setFocusMode(false);setSeconds(focusDuration);setFocusProgress(0);if(typeof document!=="undefined"&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});if(isScreenEnabled("focus"))notify("أحسنت! انتهت جلسة التركيز");sendTelegramAlert("focus",`🎯 تذكير NAVIXA: انتهت جلسة تركيز (${Math.round(focusDuration/60)} دقيقة)`);logSession();return}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[running,focusDuration]);
  const time=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  void insightsTick;
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});
  const last30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));return d.toISOString().slice(0,10)});
  const daySessions=(d:string)=>Number(localStorage.getItem(`navixa-sessions-${d}`)||0);
  const dayCups=(d:string)=>Number(localStorage.getItem(`navixa-water-${d}`)||0);
  const daySitting=(d:string)=>Number(localStorage.getItem(`navixa-sitting-${d}`)||0);
  const weeklySessions=last7.map(d=>({date:d,count:ready?daySessions(d):0}));
  const todaySessions=ready?daySessions(today()):0;
  const weekSessionsTotal=weeklySessions.reduce((sum,w)=>sum+w.count,0);
  const weekHydrationDays=ready?last7.filter(d=>dayCups(d)>=8).length:0;
  const todayWaterCups=ready?dayCups(today()):0;
  const monthSessionsTotal=ready?last30.reduce((sum,d)=>sum+daySessions(d),0):0;
  const monthWaterCups=ready?last30.reduce((sum,d)=>sum+dayCups(d),0):0;
  const weekSittingMinutes=ready?Math.round(last7.reduce((sum,d)=>sum+daySitting(d),0)/60):0;
  const monthSittingMinutes=ready?Math.round(last30.reduce((sum,d)=>sum+daySitting(d),0)/60):0;
  const monthHydrationDays=ready?last30.filter(d=>dayCups(d)>=8).length:0;
  const sessionHours:string[]=ready?JSON.parse(localStorage.getItem("navixa-session-hours")||"[]"):[];
  const bestHour=computeBestHour(sessionHours);
  const tasksDoneCount=tasks.filter(t=>t.done).length;
  const captureSpokenIntent=(spoken:string)=>{const text=spoken.trim();if(!text||text===lastIntentRef.current)return;const academic=captureAcademicDate(text);if(academic){lastIntentRef.current=text;setAcademicSuggestion(academic);notify(`رصدت ${academic.label} محتملًا — راجعه قبل الحفظ`);return}const kinds=[{words:["موعد","اجتماع","مقابلة"],label:"موعد"},{words:["تاريخ","ملاحظة","لاحظ","ركز على","تذكر"],label:"ملاحظة"}];const kind=kinds.find(k=>k.words.some(w=>text.includes(w)));if(!kind)return;const date=text.match(/(?:اليوم|بكرة|غدا|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|الساعة\s+\d{1,2}(?::\d{2})?)/)?.[0]||"من الكلام المسموع";lastIntentRef.current=text;setTasks(current=>[...current,{title:`${kind.label}: ${text}`,done:false,meta:date}]);setModal("tasks");notify(`فهمت ${kind.label} وأضفته للمهام`)};
  const saveAcademicSuggestion=()=>{if(!academicSuggestion)return;const item={title:`${academicSuggestion.label}: ${academicSuggestion.raw}`,done:false,meta:`${academicSuggestion.dateLabel} · ${academicSuggestion.timeLabel}`};setTasks(current=>[...current,item]);try{const saved=JSON.parse(localStorage.getItem("navixa-academic-notes")||"[]");localStorage.setItem("navixa-academic-notes",JSON.stringify([...saved,{...academicSuggestion,savedAt:new Date().toISOString(),reminder:"قبل يوم"}]));}catch{}setAcademicSuggestion(null);setModal("tasks");notify("تم حفظ الموعد في مهامك وملاحظاتك — التذكير الافتراضي قبل يوم")};
  const toggleListening=()=>{
  if(listeningRequestedRef.current){
    listeningRequestedRef.current=false;
    const engine=voiceEngineRef.current;
    voiceEngineRef.current=null;
    engine?.destroy();
    setListening(false);
    setInterimText("");
    return
  }
  const engine=createNavixaBrowserVoiceEngine({
    language:"ar-SA",
    continuous:true,
    interimResults:true,
    handlers:{
      onStart:()=>setListening(true),
      onTranscript:({text,interim})=>{
        const terms=splitNavixaVoiceTerms(watchTermsRef.current),matched=findNavixaVoiceTerm(text,terms);
        if(matched)alertName(matched.normalizedTerm);
        if(interim){setInterimText(text);return}
        setInterimText("");
        setHeardText(previous=>`${previous} ${text}`.trim().slice(-5000));
        captureSpokenIntent(text)
      },
      onError:(error)=>{
        if(error==="no-speech")return;
        listeningRequestedRef.current=false;
        const current=voiceEngineRef.current;
        voiceEngineRef.current=null;
        current?.destroy();
        setListening(false);
        setInterimText("");
        notify(error==="not-allowed"?"لم تُمنح صلاحية الميكروفون":"تعذر تشغيل الاستماع — تحقق من الميكروفون")
      },
      onEnd:()=>{
        setListening(false);
        setInterimText("");
        if(!listeningRequestedRef.current){voiceEngineRef.current=null;return}
        window.setTimeout(()=>{
          const current=voiceEngineRef.current;
          if(!current||!listeningRequestedRef.current)return;
          if(current.start())return;
          listeningRequestedRef.current=false;
          current.destroy();
          voiceEngineRef.current=null;
          setListening(false)
        },250)
      }
    }
  });
  if(!engine.supported){notify("متصفحك لا يدعم الاستماع الصوتي");return}
  listeningRequestedRef.current=true;
  voiceEngineRef.current=engine;
  if(engine.start()){notify("بدأ الاستماع للكلمات المختارة");return}
  listeningRequestedRef.current=false;
  voiceEngineRef.current=null;
  engine.destroy();
  notify("تعذر بدء الاستماع الآن")
};
  const toggleScreen=async()=>{
    if(screen){screenRef.current?.getTracks().forEach(t=>t.stop());screenRef.current=null;if(screenVideoRef.current)screenVideoRef.current.srcObject=null;setScreen(false);setScreenMonitoring(false);setScreenAlert("");screenPreviousRef.current=null;return}
    try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screenRef.current=stream;stream.getVideoTracks()[0].onended=()=>{setScreen(false);setScreenMonitoring(false);screenRef.current=null};setScreen(true);setScreenMonitoring(true);setScreenAlert("");screenPreviousRef.current=null;notify("تمت المشاركة — ارسم إطار المتابعة داخل المعاينة")}
    catch{notify("لم تبدأ المشاركة — اختر شاشة واسمح بالصلاحية")}
  };
  useEffect(()=>{if(typeof window!=="undefined")setScreenOcrSupported("TextDetector" in window)},[]);
  useEffect(()=>{if(screen&&screenVideoRef.current&&screenRef.current){screenVideoRef.current.srcObject=screenRef.current;screenVideoRef.current.play().catch(()=>{})}},[screen,smartTool]);
  useEffect(()=>{screenPreviousRef.current=null},[screenSelection]);
  useEffect(()=>{if(!screen||!screenMonitoring)return;const sample=()=>{const video=screenVideoRef.current,canvas=screenCanvasRef.current;if(!video||!canvas||video.readyState<2||!video.videoWidth)return;const width=160,height=90;canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;ctx.drawImage(video,0,0,width,height);const image=ctx.getImageData(0,0,width,height).data;const left=Math.floor(width*screenSelection.x/100),top=Math.floor(height*screenSelection.y/100),right=Math.max(left+1,Math.floor(width*(screenSelection.x+screenSelection.w)/100)),bottom=Math.max(top+1,Math.floor(height*(screenSelection.y+screenSelection.h)/100));const values:number[]=[];for(let y=top;y<bottom;y+=2)for(let x=left;x<right;x+=2){const i=(y*width+x)*4;values.push(image[i],image[i+1],image[i+2])}if(!screenPreviousRef.current){screenPreviousRef.current=new Uint8ClampedArray(values);return}let total=0;for(let i=0;i<values.length;i++)total+=Math.abs(values[i]-(screenPreviousRef.current[i]||0));const diff=total/Math.max(1,values.length*2.55);screenPreviousRef.current=new Uint8ClampedArray(values);const now=Date.now();if(diff>=screenSensitivity&&now-screenLastAlertRef.current>2500){screenLastAlertRef.current=now;setScreenAlert(`تغيّر واضح داخل المنطقة المحددة (${Math.round(diff)}٪)`);playAlert("urgent");setToast(`تنبيه متابعة الشاشة: ${Math.round(diff)}٪ تغيّر`);setTimeout(()=>setScreenAlert(""),3200);setTimeout(()=>setToast(""),3200)}};sample();screenMonitorTimerRef.current=setInterval(sample,700);return()=>{if(screenMonitorTimerRef.current)clearInterval(screenMonitorTimerRef.current);screenMonitorTimerRef.current=null}},[screen,screenMonitoring,screenSelection,screenSensitivity]);
  const scanScreenText=async()=>{const video=screenVideoRef.current;if(!video||video.readyState<2||!video.videoWidth||typeof window==="undefined")return;const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");if(!ctx)return;canvas.width=720;canvas.height=Math.max(180,Math.round(720*(screenSelection.h/Math.max(1,screenSelection.w))));const sx=video.videoWidth*screenSelection.x/100,sy=video.videoHeight*screenSelection.y/100,sw=video.videoWidth*screenSelection.w/100,sh=video.videoHeight*screenSelection.h/100;ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);try{let text="";const Detector=(window as any).TextDetector;if(Detector){const items=await new Detector().detect(canvas);text=items.map((item:any)=>item.rawValue||item.text||"").filter(Boolean).join(" ").trim()}else{if(!screenOcrWorkerRef.current){const {createWorker}=await import("tesseract.js");screenOcrWorkerRef.current=await createWorker("ara+eng");}const result=await screenOcrWorkerRef.current.recognize(canvas);text=String(result?.data?.text||"").replace(/\s+/g," ").trim()}if(text){setScreenOcrText(text);const terms=splitWatchTerms(screenOcrTerms);const matched=terms.find(term=>normalizeName(text).includes(term));if(matched){setScreenAlert(`تم التعرف على النص: ${matched}`);playAlert("urgent");setToast(`OCR: ظهر النص (${matched})`);setTimeout(()=>setScreenAlert(""),3200);setTimeout(()=>setToast(""),3200)}}}catch{} };
  useEffect(()=>{if(!screen||!screenOcr)return;void scanScreenText();screenOcrTimerRef.current=setInterval(()=>void scanScreenText(),1800);return()=>{if(screenOcrTimerRef.current)clearInterval(screenOcrTimerRef.current);screenOcrTimerRef.current=null}},[screen,screenOcr,screenSelection,screenOcrTerms]);
  useEffect(()=>()=>{if(screenOcrWorkerRef.current){void screenOcrWorkerRef.current.terminate();screenOcrWorkerRef.current=null}},[]);
  const pointInScreen=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100)),y:Math.max(0,Math.min(100,((event.clientY-rect.top)/rect.height)*100))}};
  const beginScreenDraw=(event:React.PointerEvent<HTMLDivElement>)=>{if((event.target as HTMLElement).closest(".screen-selection"))return;const point=pointInScreen(event);screenDragRef.current={mode:"draw",startX:point.x,startY:point.y,origin:{...screenSelection}};setScreenSelection({x:point.x,y:point.y,w:2,h:2});event.currentTarget.setPointerCapture(event.pointerId)};
  const beginScreenMove=(event:React.PointerEvent<HTMLDivElement>)=>{event.stopPropagation();const point=pointInScreen(event);screenDragRef.current={mode:"move",startX:point.x,startY:point.y,origin:{...screenSelection}};event.currentTarget.setPointerCapture(event.pointerId)};
  const beginScreenResize=(event:React.PointerEvent<HTMLSpanElement>)=>{event.stopPropagation();const rect=event.currentTarget.parentElement?.parentElement;const point=rect?pointInScreen({currentTarget:rect,clientX:event.clientX,clientY:event.clientY} as React.PointerEvent<HTMLDivElement>):{x:0,y:0};screenDragRef.current={mode:"resize",startX:point.x,startY:point.y,origin:{...screenSelection}};event.currentTarget.setPointerCapture(event.pointerId)};
  const updateScreenSelection=(event:React.PointerEvent<HTMLDivElement>)=>{const drag=screenDragRef.current;if(!drag)return;const point=pointInScreen(event);const dx=point.x-drag.startX,dy=point.y-drag.startY;if(drag.mode==="draw"){const x=Math.min(drag.startX,point.x),y=Math.min(drag.startY,point.y);setScreenSelection({x,y,w:Math.max(8,Math.abs(dx)),h:Math.max(8,Math.abs(dy))})}else if(drag.mode==="move"){setScreenSelection({...drag.origin,x:Math.max(0,Math.min(100-drag.origin.w,drag.origin.x+dx)),y:Math.max(0,Math.min(100-drag.origin.h,drag.origin.y+dy))})}else{setScreenSelection({...drag.origin,w:Math.max(12,Math.min(100-drag.origin.x,drag.origin.w+dx)),h:Math.max(12,Math.min(100-drag.origin.y,drag.origin.h+dy))})}};
  const endScreenSelection=(event:React.PointerEvent<HTMLDivElement>)=>{screenDragRef.current=null;try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}};

  useEffect(()=>{setGreeting(greetingForHour(new Date().getHours()))},[]);
  useEffect(()=>{setHideWelcomeForever(localStorage.getItem("navixa-hide-welcome")==="1");setWelcomePreferenceReady(true)},[]);
  useEffect(()=>{let stopped=false;const activate=()=>{if(!stopped)setBackgroundToolsReady(true)};const idle=window as Window & { requestIdleCallback?: (callback:()=>void, options?:{timeout:number})=>number; cancelIdleCallback?: (id:number)=>void };if(idle.requestIdleCallback){const id=idle.requestIdleCallback(activate,{timeout:1500});return()=>{stopped=true;idle.cancelIdleCallback?.(id)}}const timer=window.setTimeout(activate,350);return()=>{stopped=true;window.clearTimeout(timer)}},[]);
  useEffect(()=>{let active=true;void fetch("/api/runtime-features",{cache:"no-store"}).then(response=>response.ok?response.json():null).then((data:{features?:PublicRuntimeFeatures}|null)=>{if(active&&data?.features)setRuntimeFeatures({...DEFAULT_RUNTIME_FEATURES,...data.features})}).catch(()=>{if(active)setRuntimeFeatures(DEFAULT_RUNTIME_FEATURES)});return()=>{active=false}},[]);
  useEffect(()=>{const openAlertsFromHash=()=>{if(window.location.hash==="#alerts")setModal("alerts")};openAlertsFromHash();window.addEventListener("hashchange",openAlertsFromHash);return()=>window.removeEventListener("hashchange",openAlertsFromHash)},[]);
  const toggleWelcomeForever=()=>{setHideWelcomeForever(current=>{const next=!current;localStorage.setItem("navixa-hide-welcome",next?"1":"0");return next})};
  const showWelcomeAgain=()=>{localStorage.setItem("navixa-hide-welcome","0");setHideWelcomeForever(false);setEntered(false);setModal(null);window.scrollTo({top:0,behavior:"smooth"})};
    return <main className={`nx ${entered||hideWelcomeForever||!welcomePreferenceReady?"entered":"waiting"}`} dir={languageIdentity.ar.direction}>
    {welcomePreferenceReady&&!entered&&!hideWelcomeForever&&<HomeWelcome greeting={greeting} hideWelcomeForever={hideWelcomeForever} onEnter={()=>setEntered(true)} onOpenOverview={()=>setOverviewVideoOpen(true)} onToggleForever={toggleWelcomeForever}/>}
    {(overviewVideoOpen||tutorialOpen)&&<HomeVideoModal tutorialOpen={tutorialOpen} overviewVideoOpen={overviewVideoOpen} onCloseTutorial={()=>setTutorialOpen(null)} onHideTutorial={hideTutorial} onCloseOverview={()=>setOverviewVideoOpen(false)}/>}
    {toast&&<div className="nx-toast">✓ {toast}</div>}
    <FeatureAccessGate feature="أدواتك اليومية">{backgroundToolsReady&&<PersonalReminderEngine focusRunning={running} focusElapsedSeconds={focusDuration-seconds} onReminder={gentleReminder}/>}<section className="mobile-home-hub" aria-label="أساسيات NAVIXA للجوال">
      <header className="mobile-hub-header"><a href="#top" aria-label="العودة إلى بداية NAVIXA"><img src="/navixa-mark.webp" alt="NAVIXA SA"/></a><div><small>واجهة اليوم</small><b>خلّ يومك أبسط</b></div><a className="mobile-hub-account" href="/account">حسابي</a></header>
      <div className="mobile-hub-copy"><small>الأهم الآن</small><h1>{greeting}، وش تحتاج تسوي اليوم؟</h1><p>ابدأ بأداة واحدة. الباقي موجود في «المزيد» عندما تحتاجه.</p></div>
      <div className="mobile-primary-actions" aria-label="أدوات NAVIXA الأساسية"><button type="button" onClick={()=>setSmartTool("listener")}><span>◉</span><div><b>سماع اسم أو كلمة</b><small>تنبيه بموافقتك</small></div><i>←</i></button><button type="button" onClick={()=>setSmartTool("screen")}><span>▣</span><div><b>متابعة الشاشة</b><small>على جهازك فقط</small></div><i>←</i></button><a href="/meetings"><span>⌁</span><div><b>تلخيص اجتماع</b><small>سجّل ثم لخّص</small></div><i>←</i></a></div>
      <nav className="mobile-daily-actions" aria-label="تنقل سريع"><button type="button" onClick={()=>setModal("tasks")}><span>✓</span><b>مهامي</b></button><a href="/today"><span>◷</span><b>يومي</b></a><a href="/worship"><span>۞</span><b>وردي</b></a><button type="button" onClick={()=>setMobileMoreOpen(current=>!current)} aria-expanded={mobileMoreOpen}><span>•••</span><b>المزيد</b></button></nav>
      {mobileMoreOpen&&<section className="mobile-more-panel" aria-label="أدوات NAVIXA الإضافية"><div><small>خيارات إضافية</small><b>كل الأدوات لا تزال موجودة</b></div><div className="mobile-more-links"><button type="button" onClick={()=>{setMobileMoreOpen(false);setModal("alerts")}}>التنبيهات</button><a href="/health">صحتي</a><button type="button" onClick={()=>{setMobileMoreOpen(false);setShowMore(true);window.setTimeout(()=>document.getElementById("productivity")?.scrollIntoView({behavior:"smooth",block:"start"}),0)}}>عرض كل الأدوات والتفاصيل</button></div></section>}
    </section><section className="nx-page" id="top">
      <div className="navixa-topbar"><a href="#top" className="topbar-brand" aria-label="NAVIXA SA — يفهم يومك"><img src="/navixa-mark.webp" alt="NAVIXA SA" /><span><b dir="ltr">NAVIXA <em className="sa-badge">SA</em></b><small>يفهم يومك</small></span></a><div className="topbar-actions"><a href="/today" className="topbar-account topbar-today" aria-label="فتح صفحة يومي"><b aria-hidden="true">◷</b><span>يومي</span></a><a href="/account" className="topbar-account" aria-label="حساب NAVIXA والاشتراك"><b aria-hidden="true">⌾</b><span>حسابي</span></a><button onClick={()=>setModal("tasks")}>✓ <span>مهامي {tasks.filter(t=>!t.done).length}</span></button><button onClick={()=>setModal("alerts")}>♢ <span>التنبيهات</span></button><a href="/admin/login"><img src="/navixa-mark.webp" alt="" /><span>دخول الإدارة</span></a></div></div>
      {greetingVisible&&<header className="nx-head nx-greeting" aria-label="تحية NAVIXA"><a className="mobile-brand" href="#top"><img src="/navixa-mark.webp" alt="NAVIXA" /></a><div><small>يوم جديد · فرصة جديدة</small><h1>{greeting}، وش ودّك تنجز اليوم؟</h1></div><div><button className="greeting-dismiss" type="button" aria-label="إخفاء التحية" onClick={dismissGreeting}>×</button><button aria-label="التنبيهات" onClick={()=>setModal("alerts")}>♢<i/></button></div></header>}
            <PrayerStrip/>
      <section className="navixa-command-center" id="today" aria-labelledby="today-title">
        <div className="priority-heading"><div><small>{ar.home.today.eyebrow}</small><h2 id="today-title">{ar.home.today.title}</h2><p>{ar.home.today.description}</p></div><button onClick={()=>setModal("tasks")}>✓ مهامي {tasks.filter(t=>!t.done).length}</button></div>
        <div className="priority-feature-grid">
          <article className={`priority-feature listener-feature ${listening?"active":""}`} id="name-listener"><div className="priority-orbit"/><div className="priority-feature-top"><span className="priority-icon">◉</span><div className="priority-feature-meta"><em className="plus-badge">هِمّة</em><small>الميكروفون · بموافقتك فقط</small></div></div><div><b>{ar.smartListening.label}</b><h3>{heardMatch?listenerHeardTitle(heardMatch):ar.smartListening.readyTitle}</h3><p>{heardMatch?ar.smartListening.heardDescription:ar.smartListening.readyDescription}</p></div>{!tutorialHidden.listener?<button className="tutorial-launch" onClick={()=>setTutorialOpen("listener")}><img src="/tutorials/video-references/listen-name-reference.webp" width="480" height="854" loading="lazy" fetchPriority="low" decoding="async" alt="معاينة فيديو شرح سماع نداء الاسم"/><span><i>▶</i><b>{arCta.watchTutorial}</b><em>{ar.smartListening.tutorialDescription}</em></span></button>:<button className="tutorial-restore" onClick={()=>restoreTutorial("listener")}>↺ إظهار فيديو الشرح</button>}<div className="priority-status"><span className={listening?"live":""}>{listening?"● يستمع الآن":`○ ${ar.smartListening.idleStatus}`}</span><em>{ar.smartListening.permissionNote}</em></div><button className="priority-cta" onClick={()=>setSmartTool("listener")}>{listening?"عرض الاستماع الآن":arCta.setupNameListener} <span>←</span></button></article>
          <article className={`priority-feature screen-feature ${screen?"active":""}`} id="screen-watch"><div className="screen-grid-art"/><div className="priority-feature-top"><span className="priority-icon">▣</span><div className="priority-feature-meta"><em className="plus-badge">هِمّة</em><small>الشاشة · على جهازك فقط</small></div></div><div><b>{ar.screenMonitoring.label}</b><h3>{ar.screenMonitoring.title}</h3><p>{ar.screenMonitoring.description}</p></div>{!tutorialHidden.screen?<button className="tutorial-launch screen-tutorial" onClick={()=>setTutorialOpen("screen")}><img src="/tutorials/video-references/screen-watch-reference.webp" width="480" height="854" loading="lazy" fetchPriority="low" decoding="async" alt="معاينة فيديو شرح متابعة الشاشة"/><span><i>▶</i><b>{arCta.watchTutorial}</b><em>{ar.screenMonitoring.tutorialDescription}</em></span></button>:<button className="tutorial-restore" onClick={()=>restoreTutorial("screen")}>↺ إظهار فيديو الشرح</button>}<div className="priority-status"><span className={screen?"live":""}>{screen?"● المشاركة مفعّلة":`○ ${ar.screenMonitoring.idleStatus}`}</span><em>{ar.screenMonitoring.privacyNote}</em></div><button className="priority-cta" onClick={()=>setSmartTool("screen")}>{screen?"فتح المتابعة":arCta.chooseScreenArea} <span>←</span></button></article>
          <article className="priority-feature meeting-feature" id="meeting-summary"><div className="meeting-card-rings"/><div className="priority-feature-top"><span className="priority-icon">⌁</span><div className="priority-feature-meta"><em className="plus-badge">هِمّة</em><small>تسجيل وتلخيص · على جهازك</small></div></div><div><b>{ar.meetings.label}</b><h3>{ar.meetings.title}</h3><p>{ar.meetings.description}</p></div><div className="meeting-card-steps" aria-label="خطوات استخدام التلخيص"><span>1 سجّل</span><i>←</i><span>2 فرّغ</span><i>←</i><span>3 لخّص</span></div><div className="priority-status"><span>○ جاهز للاستخدام</span><em>{ar.meetings.privacyNote}</em></div>{!tutorialHidden.meeting?<button className="tutorial-launch meeting-tutorial" onClick={()=>setTutorialOpen("meeting")}><img src="/tutorials/video-references/meeting-summary-reference.webp" width="480" height="854" loading="lazy" fetchPriority="low" decoding="async" alt="معاينة فيديو شرح تلخيص الاجتماع"/><span><i>▶</i><b>{arCta.watchTutorial}</b><em>{ar.meetings.tutorialDescription}</em></span></button>:<button className="tutorial-restore" onClick={()=>restoreTutorial("meeting")}>↺ إظهار فيديو الشرح</button>}<a className="priority-cta" href="/meetings">{arCta.openLocalSummary} <span>{languageIdentity.ar.arrow}</span></a></article>
        </div>
        <aside className="privacy-promise"><span className="privacy-promise-icon">⌁</span><div><b>{ar.privacy.title}</b><p>{ar.privacy.description}</p></div><button onClick={()=>setModal("backup")}>{arCta.viewDataStorage} {languageIdentity.ar.arrow}</button></aside>
        {academicSuggestion&&<section className="academic-capture-card" role="status" aria-label="موعد أكاديمي مقترح"><div className="academic-capture-head"><span>◷</span><div><small>التقاط ذكي للمواعيد <em className="plus-badge">هِمّة</em></small><h3>رصد NAVIXA {academicSuggestion.label} محتملًا</h3></div><button type="button" aria-label="إغلاق الاقتراح" onClick={()=>setAcademicSuggestion(null)}>×</button></div><p>راجع المعلومات قبل الحفظ. لا يضيف NAVIXA أي موعد من دون تأكيدك.</p><div className="academic-capture-details"><span><b>النوع</b>{academicSuggestion.label}</span><span><b>التاريخ</b>{academicSuggestion.dateLabel}</span><span><b>الوقت</b>{academicSuggestion.timeLabel}</span><span><b>التذكير</b>قبل يوم</span></div><blockquote>{academicSuggestion.raw}</blockquote><div className="academic-capture-actions"><button type="button" onClick={saveAcademicSuggestion}>حفظ في مهامي وملاحظاتي</button><button type="button" className="ghost" onClick={()=>setAcademicSuggestion(null)}>تعديل لاحقًا</button></div></section>}
        {runtimeFeatures.memberPlatformRibbonEnabled&&<MemberPlatformRibbon/>}
        <button type="button" className="more-dashboard-toggle launch-tools-toggle" aria-expanded={showMore} aria-controls="launch-secondary-tools" onClick={()=>setShowMore(current=>!current)}>{showMore?"إخفاء التفاصيل":"عرض الأدوات المساندة"}<span aria-hidden="true">{showMore?"↑":"↓"}</span></button>
        {showMore&&<div className="launch-secondary-tools" id="launch-secondary-tools"><section className="secondary-paths secondary-essentials" aria-label="أدوات NAVIXA المساندة"><button onClick={running?()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"}):beginFocusMode}><span className="today-icon lavender">◎</span><div><small>{ar.productivity.label}</small><b>{ar.productivity.focus}</b><em>{running?"جلسة نشطة":`${Math.round(focusDuration/60)} دقيقة`}</em></div></button><a href="/health"><span className="today-icon rose">♡</span><div><small>{ar.health.care}</small><b>{ar.health.label}</b><em>{weekHydrationDays} أيام ترطيب</em></div></a><a href="/worship"><span className="today-icon sand" aria-hidden="true">۞</span><div><small>وردك</small><b>{ar.worship.label}</b><em>{ar.worship.description}</em></div></a><button onClick={()=>setModal("tasks")}><span className="today-icon teal">✓</span><div><small>{ar.tasks.organization}</small><b>{ar.tasks.label}</b><em>{tasks.filter(t=>!t.done).length} مهام تحتاج انتباهك</em></div></button><button onClick={()=>setModal("alerts")}><span className="today-icon sky">♢</span><div><small>{ar.notifications.settings}</small><b>{ar.notifications.label}</b><em>{ar.notifications.personalReminders}</em></div></button><button onClick={()=>setModal("appearance")}><span className="today-icon lavender">◐</span><div><small>مظهرك <em className="plus-badge">هِمّة</em></small><b>{ar.general.appearance}</b><em>{ar.general.colorsAndDarkMode}</em></div></button></section><div className="secondary-footer-tools data-only"><Link className="secondary-data-link meeting-data-link" href="/meetings">⌁ <span><small>{ar.privacy.localAndPrivate} <em className="plus-badge">هِمّة</em></small><b>{ar.meetings.personal}</b></span><i>←</i></Link><button className="secondary-data-link" onClick={()=>setModal("backup")}>⌁ <span><small>{ar.privacy.title} <em className="plus-badge">هِمّة</em></small><b>{ar.privacy.dataAndSync}</b></span><i>←</i></button></div></div>}
      </section>

      <section hidden={!showMore} className="nx-hero showcase">
        <div className="arch one"/><div className="arch two"/><div className="saudi-pattern"/>
        <div className="lavender lavender-a">⚘<br/>⚘<br/>⚘</div><div className="lavender lavender-b">⚘ ⚘</div>
        <aside className="day-board"><div className="board-title"><b>اليوم</b><span>⌄</span></div><article><i>▣</i><p><b>أولويات</b><small>مراجعة أهداف اليوم</small></p></article><article><i>▰</i><p><b>مشاريع</b><small>تقرير أداء المشروع</small></p></article><article><i>♙</i><p><b>اجتماعات</b><small>مراجعة خطة الربع</small></p></article><article><i>✓</i><p><b>مهام</b><small>{tasks.filter(t=>!t.done).length} مهام متبقية</small></p></article></aside>
        <div className="hero-center"><div className="hero-brand-wordmark" aria-label="NAVIXA SA"><span>NAVIXA</span><small>SA</small></div><img className="hero-logo-mark" src="/navixa-mark.webp" alt="" aria-hidden="true" /><h3>ذكاء يفهم يومك</h3><button className="main-ask" onClick={()=>setModal("ask")}><span>✦</span> كيف يمكنني مساعدتك اليوم؟ <i>↑</i></button><div className="quick-prompts"><button onClick={()=>setModal("ask")}>تخطيط الأسبوع ▦</button><button onClick={()=>setModal("tasks")}>تنظيم المهام ✓</button><button onClick={()=>setModal("ask")}>إعداد عرض ▣</button><button onClick={()=>setModal("ask")}>تلخيص المستندات ▤</button></div></div>
        <div className="smart-note"><small>مساعدك الذكي</small><p>لخّص لي نقاط الاجتماع<br/>واقترح الإجراءات التالية</p><button onClick={()=>setModal("ask")}>✦</button></div>
        <button className="focus-card" onClick={()=>document.getElementById("focus")?.scrollIntoView({behavior:"smooth"})}><b>تركيز</b><span>{time}</span><small>جلسة تركيز</small><i/></button>
      </section>

      <section hidden={!showMore} className="daily-strip" id="productivity"><div><small>جلسات اليوم</small><b>{todaySessions}</b><em>{todaySessions?"سجلتها اليوم":"ابدأ جلسة تركيز قصيرة"}</em></div><div><small>ماء اليوم</small><b>{todayWaterCups}/8</b><em>{todayWaterCups>=8?"أكملت هدف اليوم":"سجل كوبًا عند كل استراحة"}</em></div><div><small>المهام المكتملة</small><b>{tasks.filter(t=>t.done).length} / {tasks.length}</b><em>{tasks.length?"ابدأ بالأهم، والباقي نرتبه معك":"أضف أول مهمة لليوم"}</em></div><div><small>جلسة التركيز</small><b>{Math.round(focusDuration/60)} د</b><em>{running?"جلسة نشطة الآن":"جاهز عندما تبدأ"}</em></div></section>

      <section hidden={!showMore} className="insights-grid">
        <DailyReviewCard sessionsToday={todaySessions} tasksDone={tasksDoneCount} tasksTotal={tasks.length} bestHour={bestHour} onLogSession={logSession} onQuickTask={quickTask}/>
        <WeeklyChallengeCard weekSessions={weekSessionsTotal} weekHydrationDays={weekHydrationDays} tasksDone={tasksDoneCount}/>
        <article className="insight-card habit-insight-card"><div className="habit-insight-head"><div><small>ملخص NAVIXA</small><h3>عاداتك الصحية والإنتاجية</h3></div><span>↗</span></div><div className="habit-range-tabs"><b>هذا الأسبوع</b><em>آخر 30 يومًا</em></div><div className="habit-stats-grid"><div><span>◎</span><b>{weekSessionsTotal}</b><small>جلسات تركيز</small></div><div><span>◷</span><b>{weekSittingMinutes}د</b><small>جلوس مسجّل</small></div><div><span>💧</span><b>{weekHydrationDays}/7</b><small>أيام ترطيب</small></div></div><div className="habit-month-summary"><span>الشهر: <b>{monthSessionsTotal} جلسة · {monthSittingMinutes} دقيقة جلوس · {monthWaterCups} كوب</b></span><span>{monthHydrationDays}/30 يوم ترطيب</span></div></article>
      </section>

      <section hidden={!showMore} className="nx-section" id="assistant"><div className="section-head"><div><small>مساعدك الذكي</small><h2>كل ما تحتاجه ليوم أوضح</h2><p>أدوات مرنة تساعدك في العمل والمشاريع والمواعيد والحياة اليومية.</p></div></div>
<div className="assistant-tool-strip" aria-label="أدوات مساعدك الذكي">
          <button className="assistant-tool-card selected" onClick={()=>setSmartTool("listener")}><span className="assistant-tool-icon tool-mic">◉</span><small>استماع ذكي</small><b>الكلمات المهمة</b><em>{listening?"يستمع الآن":"جاهز"}</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("screen")}><span className="assistant-tool-icon tool-screen">▣</span><small>متابعة الشاشة</small><b>مشاركة محلية</b><em>{screen?"مفعّلة":"تجريبية"}</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("tasks")}><span className="assistant-tool-icon tool-tasks">☑</span><small>تنظيم</small><b>مهام ومواعيد</b><em>{tasks.filter(t=>!t.done).length} متبقية</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("summary")}><span className="assistant-tool-icon tool-summary">✦</span><small>ذكاء عملي</small><b>تلخيص سريع</b><em>ابدأ الآن</em></button>
          <button className="assistant-tool-card" onClick={()=>setSmartTool("links")}><span className="assistant-tool-icon tool-links">⌁</span><small>في مكان واحد</small><b>روابطك المهمة</b><em>التقويم والأدوات</em></button>
        </div>
      </section>

      <section hidden={!showMore} className="health-gateway"><div><span>♡</span><div><small>مركز NAVIXA الصحي</small><h2>جلستك، حركتك وماءك في صفحة واحدة</h2><p>مراقبة محلية للجلوس، تمارين سريعة وتذكيرات واضحة.</p></div></div><a href="/health">فتح صحتي ←</a></section>
      <section hidden={!showMore} className="worship-gateway"><div><span>﷽</span><div><small>مركز NAVIXA للورد اليومي</small><h2>مواقيت الصلاة، الأذكار وورد القرآن</h2><p>ورد يومي بسيط يدخل ضمن إنجازاتك وتقاريرك.</p></div></div><a href="/worship">فتح الورد اليومي ←</a></section>
      {focusMode&&<section className="focus-fullscreen" role="dialog" aria-label="وضع التركيز الكامل"><button className="focus-fullscreen-exit" onClick={endFocusMode}>× العودة للواجهة</button><small>وضع التركيز · {Math.round(focusDuration/60)} دقيقة</small><h2>خذ وقتك. خلّ الباقي علينا.</h2><FocusTimer className="focus-fullscreen-timer" time={time} progress={focusProgress} running={running} status="أنت الآن في وضع التركيز"/><FocusTasbihNudge running={running} elapsedSeconds={focusDuration-seconds}/><div className="focus-fullscreen-actions"><button onClick={endFocusMode}>إيقاف مؤقت</button><button onClick={resetFocusSession}>إنهاء وإعادة</button></div></section>}
      <section hidden={!showMore} className="focus-zone" id="focus"><div><small>جلسة تركيز</small><h2>خذ وقتك. خلّ الباقي علينا.</h2><p>اختر مدة جاهزة أو اكتب المدة التي تناسبك، ثم ابدأ بعيدًا عن التشتت.</p><div className="focus-duration-picker" aria-label="اختيار مدة جلسة التركيز"><span>المدة:</span>{FOCUS_PRESETS.map(minutes=><button type="button" key={minutes} disabled={running} className={focusDuration===minutes*60?"selected":""} onClick={()=>applyFocusDuration(minutes)}>{minutes} د</button>)}<label>مدة أخرى<input aria-label="مدة مخصصة بالدقائق" type="number" min="1" max="480" inputMode="numeric" disabled={running} value={focusMinutesInput} onChange={event=>{const value=event.target.value;setFocusMinutesInput(value);const minutes=Number(value);if(Number.isFinite(minutes)&&minutes>=1&&minutes<=480)applyFocusDuration(minutes)}} onBlur={()=>{const minutes=Number(focusMinutesInput);if(!Number.isFinite(minutes)||minutes<1||minutes>480)setFocusMinutesInput(String(Math.round(focusDuration/60)))}}/><b>دقيقة</b></label></div><div className="focus-actions"><button onClick={running?endFocusMode:beginFocusMode}>{running?"إيقاف مؤقت":seconds<focusDuration?"متابعة الجلسة":`ابدأ ${Math.round(focusDuration/60)} دقيقة`}</button><button className="ghost" onClick={resetFocusSession}>إعادة</button></div><FocusTasbihNudge running={running} elapsedSeconds={focusDuration-seconds}/></div><FocusTimer time={time} progress={focusProgress} running={running} status={running?"أنت الآن في وضع التركيز":seconds<focusDuration?"الجلسة متوقفة مؤقتًا":`جاهز لـ ${Math.round(focusDuration/60)} دقيقة`}/><div className="lavender-stem">✦</div></section>

      <section hidden={!showMore} className="nx-section automation" id="automations"><div className="section-head"><div><small>الأتمتة</small><h2>NAVIXA يختصر الخطوات عنك</h2><p>أنشئ قواعدك بنفسك لتتكرر في وقتها.</p></div><button onClick={()=>setModal("automation")}>＋ أتمتة جديدة</button></div><div className="automation-list">{automations.length?automations.map((x,i)=><article key={`${x.name}-${i}`}><span>{x.icon}</span><div><b>{x.name}</b><small>{x.when}</small></div><p>{x.action}</p><label><input aria-label={`تفعيل ${x.name}`} type="checkbox" checked={x.on} onChange={()=>setAutomations(automations.map((a,j)=>j===i?{...a,on:!a.on}:a))}/><i/></label></article>):<p className="automation-empty">لم تضف أتمتة بعد. ابدأ بقاعدة واحدة تناسب يومك.</p>}</div></section>

      <section hidden={!showMore} className="proof-grid"><article><span>◉</span><b>بإذنك</b><small>لا يبدأ الميكروفون دون موافقتك</small></article><article><span>▣</span><b>محليًا</b><small>لا تُرفع لقطات الشاشة إلى NAVIXA</small></article><article><span>⌁</span><b>بدون رسوم</b><small>{ar.general.noCharge}</small></article><article><span>◷</span><b>حسبك</b><small>{ar.general.personalStats}</small></article></section>
      <section hidden={!showMore} className="faq"><h2>🛡️ دليل الثقة والاستخدام الذكي</h2>{[["هل NAVIXA آمن لبياناتي؟","نعم. لا يبدأ الميكروفون أو مشاركة الشاشة إلا بعد ضغطك وموافقتك على صلاحية المتصفح."],["هل تُرفع الشاشة أو التسجيلات إلى الموقع؟","لا. المعالجة تتم داخل جلسة المتصفح ولا يحفظ الموقع صورة الشاشة أو التسجيل الصوتي."],["هل يعمل أثناء الاجتماعات الحضورية والأونلاين؟","نعم، عند تفعيل الاستماع يمكنه رصد الكلمات التي تختارها من الصوت الذي تسمح به للمتصفح."],["هل أحتاج لتسجيل حساب؟","نعم لاستخدام مزايا NAVIXA الفعلية. تبقى صفحة التعريف وسياسة الخصوصية متاحتين قبل الدخول."],["كيف يكتشف المعلومات تلقائيًا؟","من الصلاحيات التي تمنحها أنت فقط، ومن الأتمتة التي تنشئها وتفعّلها."],["كيف أوقف الصلاحيات؟","اضغط إيقاف داخل البطاقة أو استخدم مؤشر المشاركة في المتصفح لإيقافها فورًا."],["هل يمكنني إضافة أكثر من اسم؟","نعم، اكتب الأسماء أو الكلمات وافصلها بفاصلة، ولن تؤثر المسافات أو علامات الترقيم."],["هل يعمل بالعربي والإنجليزي؟","الواجهة عربية حاليًا، ويمكن توسيع الاستماع والواجهة للغات إضافية."]].map(x=><details key={x[0]}><summary>{x[0]}<span>⌄</span></summary><p>{x[1]}</p></details>)}</section>
      <section className="contact contact-simplified"><p className="contact-description">{ar.community.description}</p><div className="contact-links"><a className="contact-link email" href="mailto:login@navixasa.com" aria-label="البريد الرئيسي لـ NAVIXA"><span>✉</span><b>البريد الرئيسي</b></a>{social.x&&<a className="contact-link x" href={social.x} target="_blank" rel="noreferrer" aria-label="منصة X الرسمية"><span>𝕏</span><b>منصة X</b></a>}<a className="contact-link instagram" href={social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram الرسمي لـ NAVIXA"><span>◎</span><b>Instagram</b></a>{social.youtube&&<a className="contact-link youtube" href={social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube الرسمي لـ NAVIXA"><span>▶</span><b>YouTube</b></a>}</div></section>


    </section>


    {smartTool&&<div className="assistant-tool-modal-back" onClick={()=>setSmartTool(null)}><section className="assistant-tool-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSmartTool(null)}>×</button>{smartTool==="listener"&&<><small>استماع ذكي</small><h2>الأسماء والكلمات المهمة</h2><p>اكتب الكلمات التي تريد متابعتها. المعالجة داخل المتصفح ولا يبدأ الميكروفون إلا بعد موافقتك.</p><input aria-label="الأسماء والكلمات" value={watchTerms} onChange={e=>{setWatchTerms(e.target.value);watchTermsRef.current=e.target.value}} placeholder="اسم أو كلمة، موعد، إجراء مهم"/><div className="assistant-heard-preview"><small>ما يسمعه NAVIXA الآن</small><p>{[heardText,interimText].filter(Boolean).join(" ")||"سيظهر النص هنا بعد تشغيل الاستماع"}</p>{heardMatch&&<strong>آخر اسم تم التقاطه: {heardMatch}</strong>}</div><div className="assistant-tool-actions"><button onClick={toggleListening}>{listening?"إيقاف الاستماع":"تشغيل الاستماع"}</button><button className="ghost" onClick={()=>{setHeardText("");setInterimText("")}}>مسح النص</button></div></>}{smartTool==="screen"&&<><small>متابعة الشاشة</small><h2>{screen?"ارسم منطقة المتابعة":"شارك ثم حدّد المنطقة"}</h2><p>تظهر المعاينة داخل المتصفح فقط؛ لا يتم حفظ صورة الشاشة أو رفعها. ارسم إطارًا حرًا ثم حرّكه أو غيّر حجمه متى شئت.</p>{screen&&<div className="screen-preview-shell"><video ref={screenVideoRef} className="screen-preview-video" autoPlay muted playsInline/><canvas ref={screenCanvasRef} className="screen-analysis-canvas" aria-hidden="true"/><div className="screen-preview-overlay" onPointerDown={beginScreenDraw} onPointerMove={updateScreenSelection} onPointerUp={endScreenSelection} onPointerCancel={endScreenSelection}><div className="screen-selection" style={{left:`${screenSelection.x}%`,top:`${screenSelection.y}%`,width:`${screenSelection.w}%`,height:`${screenSelection.h}%`}} onPointerDown={beginScreenMove}><span>منطقة المتابعة</span><i onPointerDown={beginScreenResize}/></div><small>اسحب لرسم إطار جديد · اسحب الإطار لتحريكه</small></div></div>}{screen&&<div className={`screen-monitor-status ${screenAlert?"screen-alert-active":""}`}><b>{screenAlert||`المراقبة المحلية ${screenMonitoring?"مفعّلة":"متوقفة"}`}</b><label><input type="checkbox" checked={screenMonitoring} onChange={e=>{setScreenMonitoring(e.target.checked);screenPreviousRef.current=null}}/> تنبيه عند التغيّر</label><label>الحساسية <input type="range" min="5" max="35" value={screenSensitivity} onChange={e=>{setScreenSensitivity(Number(e.target.value));screenPreviousRef.current=null}}/></label><small>كلما زادت الحساسية التقط تغييرات أصغر داخل الإطار.</small><label className="screen-ocr-toggle"><input type="checkbox" checked={screenOcr} onChange={e=>{setScreenOcr(e.target.checked);setScreenOcrText("")}}/> قراءة النص داخل الإطار OCR محليًا {screenOcrSupported?"":"(قد يحتاج تحميل محرّك OCR)"}</label>{screenOcr&&<><input className="screen-ocr-terms" value={screenOcrTerms} onChange={e=>setScreenOcrTerms(e.target.value)} placeholder="نبهني عند ظهور: اسم، كلمة، رقم..."/><small className="screen-ocr-result">{screenOcrText||"سيظهر النص المقروء هنا بعد بدء التحليل"}</small></>}</div>}<button className="assistant-primary-action" onClick={toggleScreen}>{screen?"إيقاف المشاركة":"اختيار شاشة"}</button></>}{smartTool==="tasks"&&<><small>تنظيم يومك</small><h2>مهام ومواعيد</h2><p>افتح لوحة المهام لإضافة موعد أو مهمة ومتابعة الإنجاز.</p><button className="assistant-primary-action" onClick={()=>{setSmartTool(null);setModal("tasks")}}>فتح المهام</button></>}{smartTool==="summary"&&<><small>ذكاء عملي</small><h2>تلخيص سريع</h2><p>أرسل طلبك إلى NAVIXA ليحوّل النص أو الاجتماع إلى نقاط وإجراءات واضحة.</p><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلب التلخيص إلى NAVIXA");setSmartTool(null)}}><textarea required placeholder="الصق النص أو اكتب ما تريد تلخيصه..."/><button className="assistant-primary-action">إرسال للتلخيص</button></form></>}{smartTool==="links"&&<><small>في مكان واحد</small><h2>روابطك المهمة</h2><p>أضف روابطك الحقيقية مرة واحدة، وستبقى محفوظة على جهازك عند العودة للموقع.</p><div className="saved-links-grid">{savedLinks.length===0&&<div className="saved-links-empty">لا توجد روابط محفوظة بعد. أضف أول رابط من النموذج.</div>}{savedLinks.map(link=><article className="saved-link-card" key={link.id}><span>{link.icon||"↗"}</span><div><b>{link.title}</b><small>{link.description||link.url}</small></div><a href={link.url} target="_blank" rel="noreferrer" aria-label={`فتح ${link.title}`}>فتح ↗</a><div className="saved-link-actions"><button type="button" onClick={()=>{const title=window.prompt("اسم الرابط",link.title);if(title===null)return;const url=window.prompt("الرابط",link.url);if(url===null)return;const raw=url.trim();setSavedLinks(items=>items.map(item=>item.id===link.id?{...item,title:title.trim()||item.title,url:/^https?:\/\//i.test(raw)?raw:`https://${raw}`}:item))}}>تعديل</button><button type="button" onClick={()=>setSavedLinks(items=>items.filter(item=>item.id!==link.id))}>حذف</button></div></article>)}</div><form className="saved-link-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);const title=String(data.get("title")||"").trim();const raw=String(data.get("url")||"").trim();if(!title||!raw)return;const url=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;setSavedLinks(items=>[...items,{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),title,url,description:String(data.get("description")||"").trim(),icon:String(data.get("icon")||"↗").trim()||"↗"}]);event.currentTarget.reset();notify("تم حفظ الرابط على جهازك")}}><input name="title" required placeholder="اسم الرابط، مثل: التقويم"/><input name="url" required type="url" placeholder="https://example.com"/><input name="description" placeholder="وصف مختصر اختياري"/><input name="icon" maxLength={2} placeholder="أيقونة ↗"/><button className="assistant-primary-action">＋ إضافة رابط</button></form></>}</section></div>}
    {modal&&<div className="nx-modal-back" onClick={()=>setModal(null)}><section className="nx-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button>{modal==="tasks"?<><small>مهامي</small><h2>خلّ يومك واضح</h2><div className="task-list">{tasks.map((t,i)=><label key={`${t.title}-${i}`}><input type="checkbox" checked={t.done} onChange={()=>{if(!t.done)sendTelegramAlert("task",`✅ تذكير NAVIXA: تم إنجاز مهمة — ${t.title}`);setTasks(tasks.map((x,j)=>j===i?{...x,done:!x.done}:x))}}/><span className={t.done?"done":""}>{t.title}</span><button onClick={()=>setTasks(tasks.filter((_,j)=>j!==i))}>حذف</button></label>)}</div><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);setTasks([...tasks,{title:String(data.get("task")),done:false}]);e.currentTarget.reset()}}><input name="task" required placeholder="أضف مهمة جديدة..."/><button>إضافة</button></form></>:modal==="automation"?<><small>أتمتة جديدة</small><h2>أنشئ قاعدة تتكرر تلقائيًا</h2><form className="stack-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);setAutomations([...automations,{icon:"✦",name:String(d.get("name")),when:String(d.get("when")),action:String(d.get("action")),on:true}]);setModal(null);notify("تمت إضافة الأتمتة وتشغيلها")}}><input name="name" required placeholder="اسم الأتمتة"/><input name="when" required placeholder="متى تعمل؟ مثال: كل يوم 8 صباحًا"/><input name="action" required placeholder="ماذا تنفذ؟"/><button>حفظ وتشغيل</button></form></>:modal==="alerts"?<><small>مركز التنبيهات</small><h2>كل تنبيهاتك في مكان واحد</h2>
      <NotificationCenter onPreviewReminder={gentleReminder}/></>:modal==="appearance"?<><small>مظهر NAVIXA</small><h2>ألوان تناسب وقتك</h2><AppearanceSettings mode={appearanceMode} palette={appearancePalette} textScale={textScale} highContrast={highContrast} onModeChange={setAppearanceMode} onPaletteChange={setAppearancePalette} onTextScaleChange={setTextScale} onHighContrastChange={setHighContrast}/></>:modal==="backup"?<><small>بياناتك على جهازك</small><h2>تصدير واستيراد البيانات</h2><p>انقل مهامك وروابطك وتفضيلاتك بين الأجهزة عبر ملف JSON محفوظ لديك. لا يتم رفع الملف إلى NAVIXA.</p><div className="backup-actions"><button className="assistant-primary-action" onClick={exportData}>↓ تصدير نسخة احتياطية</button><button className="backup-secondary-action" onClick={()=>backupInputRef.current?.click()}>↑ استيراد نسخة</button><input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={event=>{const file=event.target.files?.[0];if(file)importData(file);event.currentTarget.value=""}}/></div><div className="cloud-sync-box"><div><b>المزامنة السحابية من حسابك</b><small>المزامنة المشفرة بين أجهزتك أصبحت مرتبطة بحساب NAVIXA بدل رمز منفصل.</small></div><Link className="assistant-primary-action" href="/account">فتح المزامنة في الحساب ←</Link></div><small className="backup-note">تصدير واستيراد JSON يبقى محليًا على جهازك. للمزامنة السحابية استخدم صفحة الحساب؛ كلمة مرور التشفير لا تُرسل إلى الخادم.</small><div className="welcome-settings-row"><span>الصفحة الترحيبية: {hideWelcomeForever?"مخفية دائمًا":"تظهر عند الدخول"}</span><button type="button" onClick={showWelcomeAgain}>عرض الترحيب من جديد</button></div></>:<><small>مساعد NAVIXA</small><h2>وش أقدر أسوي لك يا سلطان؟</h2><div className="suggestions"><button onClick={()=>notify("جهزت لك خطة يوم متوازنة")}>رتّب يومي</button><button onClick={()=>notify("أرسل النص وسألخصه لك")}>لخّص لي</button><button onClick={()=>notify("بدأ تجهيز قائمة الأولويات")}>حدّد أولوياتي</button></div><form onSubmit={e=>{e.preventDefault();notify("تم إرسال طلبك إلى NAVIXA");setModal(null)}}><input required placeholder="اكتب طلبك هنا..."/><button>إرسال</button></form></>}</section></div>}
    <OnboardingGuide onTryDemo={() => { setModal("tasks"); notify("افتح أي أداة من لوحة NAVIXA لتبدأ تجربة محلية"); }} />
    {backgroundToolsReady&&runtimeFeatures.floatingAssistantEnabled&&<FloatingAssistant openRequest={assistantOpenRequest} onAddTask={title=>{setTasks(current=>[...current,{title,done:false,meta:"استنتجها مساعد NAVIXA"}]);setModal("tasks");notify("تمت إضافة المطلوب للمهام")}}/>}
    {backgroundToolsReady&&runtimeFeatures.gameAdEnabled&&<GameAdBox/>}
    {backgroundToolsReady&&runtimeFeatures.healthNudgeEnabled&&<HealthNudge/>}
    </FeatureAccessGate>
    <section className="nx-public-footer-shell" aria-label="روابط NAVIXA العامة"><footer className="nx-site-footer"><div className="nx-brand"><img src="/navixa-mark.webp" alt="NAVIXA SA" /><div><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>ذكاء يفهم يومك</small></div></div><div className="nx-footer-links"><p>مصمم لحياة أكثر ترتيبًا.</p><Link href="/privacy" className="nx-footer-privacy">سياسة الخصوصية</Link><span>© 2026 NAVIXA SA</span></div></footer>{showCounter&&statsConfigured&&<section className="community-counters visits-only" aria-label="عداد زوار موقع NAVIXA"><div className="community-counter-card visitors"><span className="community-counter-icon">◉</span><div><small>مجتمع NAVIXA</small><b>زوار الموقع</b></div><strong>{visitCount.toLocaleString("en-US")}</strong></div></section>}</section>
  </main>
}
