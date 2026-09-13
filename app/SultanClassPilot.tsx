"use client";

import { useEffect, useMemo, useState } from "react";
import {
  academicComponentTypeLabel,
  academicDeliveryModeLabel,
  type AcademicComponentType,
  type AcademicDeliveryMode,
} from "./education/academic-section-linkage";
import "./sultan-class-pilot.css";

type ClassItem={
  code:string;
  name:string;
  componentId:string;
  meetingId:string;
  componentType:AcademicComponentType;
  deliveryMode:AcademicDeliveryMode;
  locationLabel?:string;
  days:number[];
  start:string;
  end:string;
};
type PilotResponse={enabled?:boolean;classes?:ClassItem[];reminders?:number[]};
const DEFAULT_REMINDERS=[60,30,10];
const dayNames=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
function nextOccurrence(item:ClassItem,from=new Date()){
  for(let offset=0;offset<8;offset++){
    const d=new Date(from);d.setDate(from.getDate()+offset);const [h,m]=item.start.split(":").map(Number);d.setHours(h,m,0,0);
    if(item.days.includes(d.getDay())&&d>from)return d;
  }return null;
}
export default function SultanClassPilot(){
  const [authorized,setAuthorized]=useState(false);const [checked,setChecked]=useState(false);const [classes,setClasses]=useState<ClassItem[]>([]);const [reminders,setReminders]=useState<number[]>(DEFAULT_REMINDERS);const [now,setNow]=useState(()=>new Date());const [notice,setNotice]=useState("");const [permission,setPermission]=useState<NotificationPermission|"unsupported">("unsupported");
  useEffect(()=>{
    let live=true;if("Notification" in window)setPermission(Notification.permission);
    fetch("/api/pilots/class-schedule",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?await r.json() as PilotResponse:null).then(data=>{if(!live)return;const allowed=Boolean(data?.enabled&&data.classes?.length);setAuthorized(allowed);setClasses(allowed?data!.classes!:[]);setReminders(data?.reminders?.length?data.reminders:DEFAULT_REMINDERS);setChecked(true)}).catch(()=>{if(live){setAuthorized(false);setChecked(true)}});
    const id=setInterval(()=>setNow(new Date()),15000);return()=>{live=false;clearInterval(id)};
  },[]);
  const next=useMemo(()=>classes.map(item=>({item,date:nextOccurrence(item,now)})).filter(x=>x.date).sort((a,b)=>+a.date!-+b.date!)[0],[classes,now]);
  useEffect(()=>{
    if(!authorized||!next?.date)return;const mins=Math.ceil((+next.date-+now)/60000);if(!reminders.includes(mins))return;
    const key=`navixa-class-alert-${next.item.meetingId}-${next.date.toISOString().slice(0,10)}-${mins}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");
    const component=academicComponentTypeLabel(next.item.componentType);const text=`باقي ${mins} دقيقة على ${next.item.name} · ${component}`;setNotice(text);
    if("Notification" in window&&Notification.permission==="granted")new Notification("NAVIXA · كلاسك قريب",{body:text,tag:key});
  },[authorized,next,now,reminders]);
  if(!checked||!authorized||!next?.date)return null;
  const mins=Math.max(0,Math.ceil((+next.date-+now)/60000));
  const component=academicComponentTypeLabel(next.item.componentType);const delivery=academicDeliveryModeLabel(next.item.deliveryMode);const location=next.item.locationLabel?` · ${next.item.locationLabel}`:"";
  const enableNotifications=async()=>{if(!("Notification" in window)){setPermission("unsupported");return}const result=await Notification.requestPermission();setPermission(result);if(result==="granted")setNotice("تم تفعيل تنبيهات الكلاسات على هذا الجهاز")};
  const addCalendar=()=>{const a=document.createElement("a");a.href="/api/pilots/class-schedule/calendar";a.download="NAVIXA-class-schedule-2026.ics";document.body.appendChild(a);a.click();a.remove()};
  return <section className="nx-class-pilot" aria-label="كلاسي القادم"><div><small>تجربة خاصة · كلاسي القادم</small><strong>{next.item.name}</strong><span>{component} · {dayNames[next.date.getDay()]} · {next.item.start} - {next.item.end} · {delivery}{location}</span><b>{mins<60?`باقي ${mins} دقيقة`:`الساعة ${next.item.start}`}</b><span>تقويم iPhone يُنشأ من السيرفر بتوقيت الرياض ويتوقف قبل فترة الاختبارات النهائية.</span>{notice&&<em role="status">🔔 {notice}</em>}</div><div className="nx-class-actions"><button onClick={addCalendar}>إضافة الجدول لتقويم iPhone</button>{permission!=="granted"&&permission!=="unsupported"&&<button className="nx-class-secondary" onClick={()=>void enableNotifications()}>فعّل تنبيهات NAVIXA</button>}</div></section>;
}
