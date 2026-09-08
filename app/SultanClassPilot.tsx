"use client";

import { useEffect, useMemo, useState } from "react";
import "./sultan-class-pilot.css";

type ClassItem={code:string;name:string;days:number[];start:string;end:string};
const classes:ClassItem[]=[
  {code:"101",name:"الفيزياء العامة 1",days:[0,2],start:"15:00",end:"15:50"},
  {code:"232",name:"البرمجة كائنية التوجه",days:[1,3],start:"16:00",end:"16:50"},
  {code:"231",name:"مقدمة في تقنية ونظم المعلومات",days:[0,3],start:"17:00",end:"17:50"},
  {code:"150",name:"الرياضيات المتقطعة",days:[1,3],start:"18:00",end:"18:50"},
  {code:"233",name:"تنظيم الحاسب",days:[1,3],start:"19:00",end:"19:50"},
];
const dayNames=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const pad=(n:number)=>String(n).padStart(2,"0");
const stamp=(d:Date)=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
function nextOccurrence(item:ClassItem,from=new Date()){
  for(let offset=0;offset<8;offset++){
    const d=new Date(from);d.setDate(from.getDate()+offset);const [h,m]=item.start.split(":").map(Number);d.setHours(h,m,0,0);
    if(item.days.includes(d.getDay())&&d>from)return d;
  }return null;
}
function calendarFile(){
  const now=new Date(),until=new Date("2026-12-31T23:59:59+03:00");
  const events=classes.flatMap((item)=>item.days.map(day=>{
    const start=new Date(now);start.setHours(0,0,0,0);while(start.getDay()!==day)start.setDate(start.getDate()+1);
    const [sh,sm]=item.start.split(":").map(Number),[eh,em]=item.end.split(":").map(Number);start.setHours(sh,sm,0,0);if(start<now)start.setDate(start.getDate()+7);const end=new Date(start);end.setHours(eh,em,0,0);
    return ["BEGIN:VEVENT",`UID:navixa-${item.code}-${day}@navixasa.com`,`DTSTART;TZID=Asia/Riyadh:${stamp(start)}`,`DTEND;TZID=Asia/Riyadh:${stamp(end)}`,`RRULE:FREQ=WEEKLY;UNTIL=${until.getUTCFullYear()}${pad(until.getUTCMonth()+1)}${pad(until.getUTCDate())}T205959Z`,`SUMMARY:${item.name} (${item.code})`,`DESCRIPTION:محاضرة عن بعد - NAVIXA`,`BEGIN:VALARM`,`TRIGGER:-PT60M`,`ACTION:DISPLAY`,`DESCRIPTION:باقي ساعة على ${item.name}`,`END:VALARM`,`BEGIN:VALARM`,`TRIGGER:-PT30M`,`ACTION:DISPLAY`,`DESCRIPTION:باقي 30 دقيقة على ${item.name}`,`END:VALARM`,`BEGIN:VALARM`,`TRIGGER:-PT10M`,`ACTION:DISPLAY`,`DESCRIPTION:باقي 10 دقائق على ${item.name}`,`END:VALARM`,`END:VEVENT`].join("\r\n");
  }));
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//NAVIXA//Class Pilot//AR","CALSCALE:GREGORIAN","METHOD:PUBLISH",...events,"END:VCALENDAR"].join("\r\n");
}
export default function SultanClassPilot(){
  // Private pilot guard: deliberately off for everyone unless this browser is explicitly enrolled.
  const [enabled,setEnabled]=useState(false);const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{setEnabled(localStorage.getItem("navixa-sultan-class-pilot")==="enabled");const id=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(id)},[]);
  const next=useMemo(()=>classes.map(item=>({item,date:nextOccurrence(item,now)})).filter(x=>x.date).sort((a,b)=>+a.date!-+b.date!)[0],[now]);
  if(!enabled||!next?.date)return null;
  const mins=Math.max(0,Math.round((+next.date-+now)/60000));
  const addCalendar=()=>{const blob=new Blob([calendarFile()],{type:"text/calendar;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="NAVIXA-جدولي-2026.ics";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  return <section className="nx-class-pilot" aria-label="كلاسي القادم"><div><small>تجربة خاصة · كلاسي القادم</small><strong>{next.item.name}</strong><span>{dayNames[next.date.getDay()]} · {next.item.start} - {next.item.end} · عن بُعد</span><b>{mins<60?`باقي ${mins} دقيقة`:`الساعة ${next.item.start}`}</b></div><button onClick={addCalendar}>إضافة الجدول لتقويم iPhone</button></section>;
}
