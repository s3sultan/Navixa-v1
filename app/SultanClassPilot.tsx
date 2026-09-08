"use client";

import { useEffect, useMemo, useState } from "react";
import "./sultan-class-pilot.css";

type ClassItem={code:string;name:string;days:number[];start:string;end:string};
type PilotResponse={enabled?:boolean;classes?:ClassItem[];reminders?:number[];recurrenceUntilUtc?:string};
const DEFAULT_REMINDERS=[60,30,10];
const dayNames=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const pad=(n:number)=>String(n).padStart(2,"0");
const stamp=(d:Date)=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
function nextOccurrence(item:ClassItem,from=new Date()){
  for(let offset=0;offset<8;offset++){
    const d=new Date(from);d.setDate(from.getDate()+offset);const [h,m]=item.start.split(":").map(Number);d.setHours(h,m,0,0);
    if(item.days.includes(d.getDay())&&d>from)return d;
  }return null;
}
function calendarFile(classes:ClassItem[],reminders:number[],recurrenceUntilUtc:string){
  const now=new Date();
  const events=classes.flatMap((item)=>item.days.map(day=>{
    const start=new Date(now);start.setHours(0,0,0,0);while(start.getDay()!==day)start.setDate(start.getDate()+1);
    const [sh,sm]=item.start.split(":").map(Number),[eh,em]=item.end.split(":").map(Number);start.setHours(sh,sm,0,0);if(start<now)start.setDate(start.getDate()+7);const end=new Date(start);end.setHours(eh,em,0,0);
    const alarms=reminders.flatMap(min=>["BEGIN:VALARM",`TRIGGER:-PT${min}M`,`ACTION:DISPLAY`,`DESCRIPTION:باقي ${min} دقيقة على ${item.name}`,"END:VALARM"]);
    return ["BEGIN:VEVENT",`UID:navixa-${item.code}-${day}@navixasa.com`,`DTSTART;TZID=Asia/Riyadh:${stamp(start)}`,`DTEND;TZID=Asia/Riyadh:${stamp(end)}`,`RRULE:FREQ=WEEKLY;UNTIL=${recurrenceUntilUtc}`,`SUMMARY:${item.name} (${item.code})`,`DESCRIPTION:محاضرة عن بعد - NAVIXA`,...alarms,"END:VEVENT"].join("\r\n");
  }));
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//NAVIXA//Class Pilot//AR","CALSCALE:GREGORIAN","METHOD:PUBLISH",...events,"END:VCALENDAR"].join("\r\n");
}
export default function SultanClassPilot(){
  const [authorized,setAuthorized]=useState(false);const [checked,setChecked]=useState(false);const [classes,setClasses]=useState<ClassItem[]>([]);const [reminders,setReminders]=useState<number[]>(DEFAULT_REMINDERS);const [recurrenceUntilUtc,setRecurrenceUntilUtc]=useState("");const [now,setNow]=useState(()=>new Date());const [notice,setNotice]=useState("");const [permission,setPermission]=useState<NotificationPermission|"unsupported">("unsupported");
  useEffect(()=>{
    let live=true;if("Notification" in window)setPermission(Notification.permission);
    fetch("/api/pilots/class-schedule",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?await r.json() as PilotResponse:null).then(data=>{if(!live)return;const allowed=Boolean(data?.enabled&&data.classes?.length&&data.recurrenceUntilUtc);setAuthorized(allowed);setClasses(allowed?data!.classes!:[]);setReminders(data?.reminders?.length?data.reminders:DEFAULT_REMINDERS);setRecurrenceUntilUtc(data?.recurrenceUntilUtc||"");setChecked(true)}).catch(()=>{if(live){setAuthorized(false);setChecked(true)}});
    const id=setInterval(()=>setNow(new Date()),15000);return()=>{live=false;clearInterval(id)};
  },[]);
  const next=useMemo(()=>classes.map(item=>({item,date:nextOccurrence(item,now)})).filter(x=>x.date).sort((a,b)=>+a.date!-+b.date!)[0],[classes,now]);
  useEffect(()=>{
    if(!authorized||!next?.date)return;const mins=Math.ceil((+next.date-+now)/60000);if(!reminders.includes(mins))return;
    const key=`navixa-class-alert-${next.item.code}-${next.date.toISOString().slice(0,10)}-${mins}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");
    const text=`باقي ${mins} دقيقة على ${next.item.name}`;setNotice(text);
    if("Notification" in window&&Notification.permission==="granted")new Notification("NAVIXA · كلاسك قريب",{body:text,tag:key});
  },[authorized,next,now,reminders]);
  if(!checked||!authorized||!next?.date)return null;
  const mins=Math.max(0,Math.ceil((+next.date-+now)/60000));
  const enableNotifications=async()=>{if(!("Notification" in window)){setPermission("unsupported");return}const result=await Notification.requestPermission();setPermission(result);if(result==="granted")setNotice("تم تفعيل تنبيهات الكلاسات على هذا الجهاز")};
  const addCalendar=()=>{if(!recurrenceUntilUtc)return;const blob=new Blob([calendarFile(classes,reminders,recurrenceUntilUtc)],{type:"text/calendar;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="NAVIXA-جدولي-2026.ics";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  return <section className="nx-class-pilot" aria-label="كلاسي القادم"><div><small>تجربة خاصة · كلاسي القادم</small><strong>{next.item.name}</strong><span>{dayNames[next.date.getDay()]} · {next.item.start} - {next.item.end} · عن بُعد</span><b>{mins<60?`باقي ${mins} دقيقة`:`الساعة ${next.item.start}`}</b><span>تقويم iPhone يتكرر حتى ما قبل بدء الاختبارات النهائية الرسمية.</span>{notice&&<em role="status">🔔 {notice}</em>}</div><div className="nx-class-actions"><button onClick={addCalendar}>إضافة الجدول لتقويم iPhone</button>{permission!=="granted"&&permission!=="unsupported"&&<button className="nx-class-secondary" onClick={()=>void enableNotifications()}>فعّل تنبيهات NAVIXA</button>}</div></section>;
}
