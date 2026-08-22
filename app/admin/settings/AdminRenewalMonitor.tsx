"use client";

import { useEffect, useState } from "react";

type Summary={endingSoon:number;remindersSent:number;foundersWaiting:number;foundersRevealed:number};
type Ending={id:string;contact:string;display_name:string;plan:string;status:string;ends_at:string};
type Reminder={subscriber_id:string;reminder_type:"four_days"|"one_day";channel:"email"|"telegram";status:"pending"|"sending"|"sent"|"failed";sent_at:string;error_message:string;updated_at:string};
type Founder={contact:string;unlock_at:string;badge_until:string;revealed_at:string;created_at:string};
type Monitor={summary:Summary;ending:Ending[];reminders:Reminder[];founders:Founder[]};
const empty:Monitor={summary:{endingSoon:0,remindersSent:0,foundersWaiting:0,foundersRevealed:0},ending:[],reminders:[],founders:[]};
const date=(value:string)=>value?new Intl.DateTimeFormat("ar-SA",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Asia/Riyadh"}).format(new Date(value)):"—";
const days=(value:string)=>Math.max(0,Math.ceil((Date.parse(value)-Date.now())/86_400_000));

export default function AdminRenewalMonitor(){
  const [data,setData]=useState<Monitor>(empty),[loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const response=await fetch("/api/admin/subscription-monitor",{cache:"no-store"});if(response.ok)setData(await response.json() as Monitor)}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  return <section className="renewal-monitor" aria-label="مراقبة التجديد والمؤسسين">
    <div className="panel-head"><div><small>تشغيل آلي</small><h3>تذكيرات التجديد ومؤسسو NAVIXA</h3><p>رسالة قبل 4 أيام، ورسالة واحدة قبل يوم عند الحاجة. Telegram يصل فقط لمن فعّل التذكير وربط البوت.</p></div><button onClick={()=>void load()}>{loading?"جارٍ التحديث…":"تحديث"}</button></div>
    <div className="renewal-summary"><article><small>تنتهي خلال 4 أيام</small><b>{data.summary.endingSoon}</b><span>تجارب واشتراكات</span></article><article><small>رسائل خلال 30 يومًا</small><b>{data.summary.remindersSent}</b><span>بريد أو Telegram</span></article><article><small>مؤسس ذهبي بانتظار الكشف</small><b>{data.summary.foundersWaiting}</b><span>تظهر بعد أسبوع</span></article><article><small>مزايا ذهبية مكشوفة</small><b>{data.summary.foundersRevealed}</b><span>صالحة لمدة عام</span></article></div>
    <div className="renewal-grid"><div><h4>تنتهي قريبًا</h4>{data.ending.length?<ul className="renewal-list">{data.ending.map(item=><li key={item.id}><div><b>{item.display_name||item.contact}</b><small>{item.status==="trial"?"تجربة Plus":"Plus"} · {item.plan}</small></div><span><b>{days(item.ends_at)} أيام</b><small>{date(item.ends_at)}</small></span></li>)}</ul>:<p className="monitor-empty">لا توجد اشتراكات أو تجارب تنتهي خلال أربعة أيام.</p>}</div><div><h4>المؤسس الذهبي</h4>{data.founders.length?<ul className="renewal-list">{data.founders.map(item=>{const waiting=Date.parse(item.unlock_at)>Date.now();return <li key={item.contact}><div><b>{item.contact}</b><small>{waiting?"لا تُعرض الشارة بعد":"الشارة متاحة"}</small></div><span><b>{waiting?date(item.unlock_at):"مفعّلة"}</b><small>{waiting?"موعد الكشف":"حتى "+date(item.badge_until)}</small></span></li>})}</ul>:<p className="monitor-empty">لا يوجد مؤسس ذهبي بعد.</p>}</div></div>
    {data.reminders.length>0&&<div className="reminder-history"><h4>آخر التذكيرات</h4><ul>{data.reminders.slice(0,8).map((item,index)=><li key={`${item.subscriber_id}-${item.reminder_type}-${item.channel}-${index}`}><span>{item.channel==="email"?"بريد":"Telegram"}</span><b>{item.reminder_type==="four_days"?"قبل 4 أيام":"قبل يوم"}</b><small className={item.status}>{item.status==="sent"?"تم الإرسال":item.status==="failed"?"تعذر الإرسال":"قيد المعالجة"}</small></li>)}</ul></div>}
  </section>;
}
