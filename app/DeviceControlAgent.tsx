"use client";

import { useCallback, useEffect, useState } from "react";
import "./device-control.css";

type Command="prepare_name_listener"|"prepare_screen_watch"|"open_alerts"|"open_account_sync";
type RequestItem={id:string;command:Command;created_at:string;expires_at:string};
type Payload={deviceClass?:"mobile"|"computer";pending?:RequestItem[]};
const info:Record<Command,{title:string;body:string;action:string;href:string;icon:string}>={
  prepare_name_listener:{title:"طلب من جوالك: استماع الاسم",body:"افتح NAVIXA ثم شغّل الاستماع بنفسك. المتصفح سيطلب إذن الصوت أو مشاركة التبويب عند الحاجة.",action:"فتح NAVIXA",href:"/",icon:"🎙"},
  prepare_screen_watch:{title:"طلب من جوالك: متابعة الشاشة",body:"افتح NAVIXA ثم اختر أداة متابعة الشاشة. اختيار الشاشة أو التبويب يجب أن يتم منك على هذا الكمبيوتر.",action:"فتح NAVIXA",href:"/",icon:"▣"},
  open_alerts:{title:"طلب من جوالك: مركز التنبيهات",body:"افتح NAVIXA لمراجعة مركز التنبيهات والبوش وTelegram من هذا الكمبيوتر.",action:"فتح NAVIXA",href:"/",icon:"🔔"},
  open_account_sync:{title:"طلب من جوالك: المزامنة",body:"افتح صفحة الحساب لاستعادة أو رفع النسخة المشفرة. كلمة التشفير لا تنتقل في طلب التحكم.",action:"فتح الحساب",href:"/account",icon:"↻"},
};

export default function DeviceControlAgent(){
  const [item,setItem]=useState<RequestItem|null>(null);
  const poll=useCallback(async()=>{try{const r=await fetch("/api/device-control",{cache:"no-store"});if(!r.ok)return false;const p=await r.json() as Payload;if(p.deviceClass!=="computer")return false;setItem(current=>current||p.pending?.[0]||null);return true}catch{return false}},[]);
  useEffect(()=>{let timer:number|null=null,cancelled=false;const boot=async()=>{try{const session=await fetch("/api/account/session",{cache:"no-store"});if(!session.ok)return;const data=await session.json() as {signedIn?:boolean};if(cancelled||!data.signedIn)return;const computer=await poll();if(!cancelled&&computer)timer=window.setInterval(()=>{if(document.visibilityState==="visible")void poll()},12000)}catch{}};void boot();return()=>{cancelled=true;if(timer!==null)window.clearInterval(timer)}},[poll]);
  const finish=async(outcome:"acknowledged"|"dismissed",navigate=false)=>{if(!item)return;const href=info[item.command].href;let accepted=false;try{const response=await fetch("/api/device-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"acknowledge",requestId:item.id,outcome})});accepted=response.ok}catch{}setItem(null);if(accepted&&navigate){window.location.assign(href);return}if(accepted)void poll()};
  if(!item)return null;
  const copy=info[item.command];
  return <div className="device-control-agent" dir="rtl" role="dialog" aria-live="polite" aria-label={copy.title}><div className="device-control-agent-icon">{copy.icon}</div><div className="device-control-agent-copy"><small>تحكم NAVIXA من الجوال</small><h2>{copy.title}</h2><p>{copy.body}</p><span>ينتهي الطلب تلقائيًا خلال 5 دقائق ولا يشغّل ميكروفونًا أو شاشة من دونك.</span><div><button type="button" onClick={()=>void finish("acknowledged",true)}>{copy.action}</button><button type="button" className="ghost" onClick={()=>void finish("dismissed")}>تجاهل</button></div></div></div>;
}
