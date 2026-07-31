"use client";

import { useState } from "react";
import "./ads.css";

const initialCampaigns = [
  {name:"موسم الزراعة الصيفي",client:"مزارع الوادي",place:"بطاقة داخل المزرعة",views:"184,240",clicks:"4.8%",budget:"3,200 ر.س",status:"نشطة",on:true,color:"green"},
  {name:"حساسات رطوبة ذكية",client:"تقنيات نماء",place:"الشريط الرئيسي",views:"96,810",clicks:"6.2%",budget:"2,450 ر.س",status:"نشطة",on:true,color:"blue"},
  {name:"خصم معدات الري",client:"متجر حصاد",place:"صفحة التقارير",views:"41,950",clicks:"3.4%",budget:"1,180 ر.س",status:"مجدولة",on:false,color:"orange"},
  {name:"استشارة زراعية مجانية",client:"خبراء الأرض",place:"مساعد NAVIXA",views:"28,610",clicks:"7.1%",budget:"950 ر.س",status:"مراجعة",on:false,color:"purple"},
];

export default function AdsPage(){
  const [campaigns,setCampaigns]=useState(initialCampaigns);
  const [filter,setFilter]=useState("الكل");
  const [toast,setToast]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(""),2300)};
  const createCampaign=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const name=String(data.get("campaign")||"").trim();
    const client=String(data.get("advertiser")||"").trim();
    const place=String(data.get("placement")||"");
    const budget=String(data.get("budget")||"0");
    setCampaigns(current=>[...current,{name,client,place,views:"0",clicks:"0%",budget:`${Number(budget).toLocaleString("ar-SA")} ر.س`,status:"مجدولة",on:false,color:"green"}]);
    setFilter("الكل");
    setShowCreate(false);
    say("تم إنشاء الحملة وإضافتها إلى القائمة");
  };
  const toggle=(i:number)=>{const n=[...campaigns];n[i]={...n[i],on:!n[i].on,status:!n[i].on?"نشطة":"متوقفة"};setCampaigns(n);say(`${n[i].name}: ${n[i].status}`)};
  const visible=filter==="الكل"?campaigns:campaigns.filter(c=>c.status===filter);
  return <main dir="rtl" className="ads-shell">
    {toast&&<div className="toast">✓ {toast}</div>}
    <aside className="admin-side ads-side"><div className="logo"><span>ن</span><div><b>NAVIXA</b><small>ADMIN CENTER</small></div></div><div className="admin-badge">لوحة الإدارة</div><nav><a href="/admin"><i>⌂</i>نظرة عامة</a><a href="/admin"><i>✦</i>المميزات</a><a href="/admin"><i>♙</i>المستخدمون</a><a href="/admin"><i>⌁</i>الأجهزة</a><a href="/admin"><i>⚙</i>الأتمتة</a><a className="on" href="/admin/ads"><i>▣</i>الإعلانات<em>4</em></a><a href="/admin"><i>!</i>التنبيهات</a><a href="/admin"><i>▤</i>سجل النظام</a></nav><div className="admin-side-bottom"><a href="/">← العودة إلى NAVIXA</a><div><span>م</span><p><b>محمد</b><small>مدير النظام</small></p></div></div></aside>
    <section className="admin-page ads-page">
      <header className="ads-header"><div><small>التسويق والإيرادات</small><h1>إدارة الإعلانات</h1><p>أنشئ الحملات، اختر مكان الظهور، وتابع الأداء لحظة بلحظة.</p></div><button onClick={()=>setShowCreate(true)}>＋ حملة جديدة</button></header>
      <section className="ads-metrics"><article><span>◉</span><div><small>مرات الظهور</small><b>351.6K</b><em>↑ 18.2%</em></div></article><article><span>↗</span><div><small>النقرات</small><b>18,940</b><em>5.4% CTR</em></div></article><article><span>ر.س</span><div><small>الإيراد هذا الشهر</small><b>7,780</b><em>↑ 12.6%</em></div></article><article><span>◎</span><div><small>الحملات النشطة</small><b>2 من 4</b><em>2 بانتظارك</em></div></article></section>
      <section className="ad-insight"><div><span>✦</span><div><small>اقتراح NAVIXA</small><h2>أفضل وقت لنشر إعلانك القادم هو الأحد، الساعة 7:30 مساءً</h2><p>بناءً على نشاط 2,847 مستخدمًا خلال آخر 30 يومًا.</p></div></div><button onClick={()=>say("تم تطبيق الجدولة الذكية على الحملة القادمة")}>تطبيق الجدولة الذكية</button></section>
      <section className="panel campaigns"><div className="campaign-head"><div><small>الحملات</small><h2>كل الإعلانات</h2></div><div className="filters">{["الكل","نشطة","مجدولة","مراجعة","متوقفة"].map(f=><button key={f} className={filter===f?"on":""} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="campaign-table"><div className="table-head"><span>الحملة</span><span>مكان الظهور</span><span>المشاهدات</span><span>النقر</span><span>الميزانية</span><span>الحالة</span><span>تشغيل</span></div>{visible.map((c,i)=><div className="campaign-row" key={c.name}><div><span className={`ad-thumb ${c.color}`}>▣</span><p><b>{c.name}</b><small>{c.client}</small></p></div><span>{c.place}</span><b>{c.views}</b><b>{c.clicks}</b><span>{c.budget}</span><em className={`campaign-status ${c.status}`}>● {c.status}</em><label><input aria-label={`تشغيل ${c.name}`} type="checkbox" checked={c.on} onChange={()=>toggle(campaigns.indexOf(c))}/><i/></label></div>)}</div></section>
      <div className="ad-bottom"><section className="panel"><div className="panel-head"><div><small>أماكن الظهور</small><h2>أداء المساحات الإعلانية</h2></div></div>{[["الشريط الرئيسي","142K","6.1%"],["داخل المزرعة","118K","5.2%"],["مساعد NAVIXA","54K","7.1%"],["صفحة التقارير","37K","3.4%"]].map((x,i)=><div className="placement" key={x[0]}><span>{i+1}</span><b>{x[0]}</b><small>{x[1]} ظهور</small><em>{x[2]} CTR</em></div>)}</section><section className="panel"><div className="panel-head"><div><small>الموافقات</small><h2>بانتظار المراجعة</h2></div></div><div className="approval"><span className="ad-thumb purple">▣</span><div><b>استشارة زراعية مجانية</b><small>خبراء الأرض · أُرسلت اليوم</small></div><button onClick={()=>say("تمت الموافقة على الإعلان")}>موافقة</button><button className="reject" onClick={()=>say("تم إرجاع الإعلان للتعديل")}>تعديل</button></div><div className="approval-note">تأكد أن الإعلان مناسب لهوية NAVIXA ولا يعيق تجربة المستخدم.</div></section></div>
    </section>
    {showCreate&&<div className="modal-back" onClick={()=>setShowCreate(false)}><form className="ad-modal" onClick={e=>e.stopPropagation()} onSubmit={createCampaign}><button type="button" className="close" onClick={()=>setShowCreate(false)}>×</button><small>حملة جديدة</small><h2>أنشئ إعلانًا جديدًا</h2><label>اسم الحملة<input name="campaign" required placeholder="مثال: عروض موسم الحصاد"/></label><label>المعلن<input name="advertiser" required placeholder="اسم الشركة أو الجهة"/></label><label>مكان الظهور<select name="placement"><option>الشريط الرئيسي</option><option>داخل المزرعة</option><option>مساعد NAVIXA</option><option>صفحة التقارير</option></select></label><div><label>الميزانية<input name="budget" type="number" min="0" placeholder="2,000"/></label><label>تاريخ البداية<input name="startDate" type="date"/></label></div><button type="submit">إنشاء الحملة</button></form></div>}
  </main>
}
