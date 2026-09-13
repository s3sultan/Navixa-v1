"use client";

import { useCallback, useEffect, useState } from "react";

type Command="prepare_name_listener"|"prepare_screen_watch"|"open_alerts"|"open_account_sync";
type Recent={id:string;command:Command;status:"pending"|"acknowledged"|"dismissed"|"expired";created_at:string;expires_at:string};
type Payload={deviceClass?:"mobile"|"computer";computerSessionAvailable?:boolean;recent?:Recent[];error?:string};
const labels:Record<Command,{title:string;detail:string;icon:string}>={
  prepare_name_listener:{title:"جهّز استماع الاسم",detail:"يرسل طلبًا للكمبيوتر لفتح تعليمات الاستماع. التشغيل يبقى بموافقتك على الكمبيوتر.",icon:"🎙"},
  prepare_screen_watch:{title:"جهّز متابعة الشاشة",detail:"ينبّه الكمبيوتر لفتح أداة الشاشة. اختيار الشاشة يبقى إلزاميًا من المتصفح.",icon:"▣"},
  open_alerts:{title:"افتح مركز التنبيهات",detail:"يطلب من الكمبيوتر فتح NAVIXA على مركز التنبيهات.",icon:"🔔"},
  open_account_sync:{title:"افتح المزامنة",detail:"يفتح صفحة الحساب على الكمبيوتر. كلمة تشفير المزامنة لا تنتقل بين الجهازين.",icon:"↻"},
};
const statusLabel=(value:Recent["status"])=>value==="pending"?"بانتظار الكمبيوتر":value==="acknowledged"?"تمت الاستجابة":value==="expired"?"انتهت المهلة":"تم التجاهل";

export default function DeviceControlPanel(){
  const [data,setData]=useState<Payload>({}),[loading,setLoading]=useState(true),[sending,setSending]=useState<Command|null>(null),[notice,setNotice]=useState("");
  const load=useCallback(async()=>{try{const r=await fetch("/api/device-control",{cache:"no-store"});const p=await r.json() as Payload;if(!r.ok){setData({error:p.error||"تعذر قراءة حالة الأجهزة"});throw new Error(p.error||"تعذر قراءة حالة الأجهزة")}setData(p);setNotice("")}catch(e){setNotice(e instanceof Error?e.message:"تعذر قراءة حالة الأجهزة")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer)},[load]);
  const send=async(command:Command)=>{setSending(command);setNotice("");try{const r=await fetch("/api/device-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",command})});const p=await r.json() as {error?:string;reused?:boolean};if(!r.ok)throw new Error(p.error||"تعذر إرسال الطلب");setNotice(p.reused?"هذا الطلب ما زال بانتظار الكمبيوتر، لذلك لم نكرر إرساله":"تم إرسال الطلب للكمبيوتر لمدة 5 دقائق فقط");await load()}catch(e){setNotice(e instanceof Error?e.message:"تعذر إرسال الطلب")}finally{setSending(null)}};
  if(loading)return <section className="account-card device-control-card"><span>تحكم الأجهزة</span><h2>جارٍ فحص جلساتك…</h2></section>;
  if(!data.deviceClass)return <section className="account-card device-control-card"><span>تحكم الأجهزة</span><h2>سجّل الدخول أولًا</h2><p>بعد تسجيل الدخول بنفس الحساب على الجوال والكمبيوتر، يربط NAVIXA الطلبات بين الجهازين.</p>{notice&&<p className="account-notice">{notice}</p>}</section>;
  if(data.deviceClass!=="mobile")return <section className="account-card device-control-card"><span>تحكم الأجهزة</span><h2>التحكم من الجوال</h2><p>افتح نفس الحساب من جوالك لتظهر أوامر تجهيز الكمبيوتر. هذا الكمبيوتر سيطلب موافقتك قبل تشغيل أي أداة حساسة.</p><div className="device-control-safe">✓ الميكروفون ومشاركة الشاشة لا يعملان تلقائيًا</div></section>;
  return <section className="account-card device-control-card"><span>تحكم الأجهزة</span><h2>جهّز الكمبيوتر من جوالك</h2><p>أرسل طلبًا قصير العمر إلى جلسة الكمبيوتر المرتبطة بنفس الحساب.</p><div className={`device-control-target ${data.computerSessionAvailable?"is-ready":""}`}><i/>{data.computerSessionAvailable?"جلسة كمبيوتر صالحة موجودة":"لا توجد جلسة كمبيوتر صالحة حاليًا"}</div><div className="device-control-actions">{(Object.keys(labels) as Command[]).map(command=><button type="button" key={command} onClick={()=>void send(command)} disabled={!data.computerSessionAvailable||Boolean(sending)}><span>{labels[command].icon}</span><div><b>{labels[command].title}</b><small>{labels[command].detail}</small></div><em>{sending===command?"إرسال…":"إرسال"}</em></button>)}</div>{notice&&<p className="account-notice">{notice}</p>}{Boolean(data.recent?.length)&&<div className="device-control-recent"><b>آخر الطلبات</b>{data.recent?.slice(0,4).map(item=><div key={item.id}><span>{labels[item.command].title}</span><small>{statusLabel(item.status)}</small></div>)}</div>}</section>;
}
