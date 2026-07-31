"use client";

import { useState } from "react";

const features = [
  { name: "متابعة نطق الاسم", desc: "التعرّف على الاسم والتنبيه الصوتي", icon: "◉", users: "1,284", on: true },
  { name: "مراقبة الشاشة", desc: "اكتشاف المغادرة والتغييرات المهمة", icon: "▣", users: "938", on: true },
  { name: "المواعيد والمهام", desc: "تذكيرات ومهام ذكية", icon: "▦", users: "2,106", on: true },
  { name: "المزرعة المؤتمتة", desc: "حساسات وري وطقس وتسميد", icon: "♧", users: "426", on: true },
  { name: "جلسات التركيز", desc: "مؤقت بومودورو وتحليل الإنتاجية", icon: "◎", users: "1,750", on: true },
  { name: "الملاحظات السريعة", desc: "حفظ وتصدير الملاحظات", icon: "▤", users: "1,492", on: true },
];

export default function AdminPage() {
  const [enabled, setEnabled] = useState(features.map(f => f.on));
  const [section, setSection] = useState("نظرة عامة");
  const [toast, setToast] = useState("");
  const tell = (s:string) => {setToast(s);setTimeout(()=>setToast(""),2400)};
  const toggle = (i:number) => {const next=[...enabled];next[i]=!next[i];setEnabled(next);tell(`${features[i].name}: ${next[i]?"مفعّلة":"متوقفة"}`)};

  return <main dir="rtl" className="admin-shell">
    {toast && <div className="toast">✓ {toast}</div>}
    <aside className="admin-side"><div className="logo"><span>ن</span><div><b>NAVIXA</b><small>ADMIN CENTER</small></div></div><div className="admin-badge">لوحة الإدارة</div>
      <nav>{["نظرة عامة","المميزات","الزوار","الأجهزة","الأتمتة"].map((x,i)=><button key={x} className={section===x?"on":""} onClick={()=>{setSection(x);document.getElementById(x==="الزوار"?"visitors":x==="الأجهزة"?"devices":x==="الأتمتة"?"automation-admin":"overview")?.scrollIntoView({behavior:"smooth"})}}><i>{["⌂","✦","♙","⌁","⚙"][i]}</i>{x}</button>)}<button onClick={()=>window.location.href="/admin/ads"}><i>▣</i>الإعلانات<em>4</em></button><button onClick={()=>window.location.href="/admin/emergency"}><i>⚠</i>الطوارئ</button><button onClick={()=>window.location.href="/admin/social"}><i>◎</i>التواصل</button>{["التنبيهات","سجل النظام"].map((x,i)=><button key={x} className={section===x?"on":""} onClick={()=>{setSection(x);tell(x==="التنبيهات"?"3 تنبيهات: اجتماع قريب، أجهزة ضعيفة، ومهمة متأخرة":`تم فتح ${x}`)}}><i>{["!","▤"][i]}</i>{x}{x==="التنبيهات"&&<em>3</em>}</button>)}</nav>
      <div className="admin-side-bottom"><a href="/">← العودة إلى NAVIXA</a><div><span>س</span><p><b>سلطان</b><small>مدير النظام</small></p></div></div>
    </aside>

    <section className="admin-page">
      <header className="admin-header" id="overview"><div><small>مركز التحكم</small><h1>أهلًا سلطان، النظام يعمل بكفاءة.</h1><p>إدارة NAVIXA والزوار والأجهزة من مكان واحد.</p></div><div><button onClick={()=>tell("3 تنبيهات جديدة تحتاج مراجعتك")}>♢<i/></button><a href="/">عرض التطبيق ↗</a></div></header>

      <section className="health-banner"><div><span className="health-icon">✓</span><div><small>حالة النظام</small><h2>جميع الخدمات تعمل بشكل طبيعي</h2><p>آخر فحص قبل 38 ثانية · وقت التشغيل 99.98%</p></div></div><div className="service-pills"><span><i/> الذكاء الاصطناعي</span><span><i/> التنبيهات</span><span><i/> أجهزة IoT</span><span><i/> قاعدة البيانات</span></div></section>

      <section className="admin-metrics">
        <article id="visitors"><span className="am-icon purple">♙</span><div><small>الزوار اليوم</small><b>1,284</b><em>+12.4% عن أمس</em></div></article>
        <article><span className="am-icon green">⌁</span><div><small>الأجهزة المتصلة</small><b>1,396</b><em>98.7% متصلة</em></div></article>
        <article><span className="am-icon blue">✦</span><div><small>عمليات ذكية اليوم</small><b>18,429</b><em>96% ناجحة</em></div></article>
        <article><span className="am-icon orange">♢</span><div><small>التنبيهات المرسلة</small><b>4,815</b><em>+8.2% اليوم</em></div></article>
      </section>

      <div className="admin-grid">
        <section className="panel feature-panel"><div className="panel-head"><div><small>إدارة المميزات</small><h2>خدمات NAVIXA</h2></div><button onClick={()=>setSection("المميزات")}>إدارة الكل ←</button></div><div className="feature-list">{features.map((f,i)=><div className="feature-row" key={f.name}><span className={`feature-icon f${i}`}>{f.icon}</span><div><b>{f.name}</b><small>{f.desc}</small></div><span className="use-count">{f.users} مستخدم</span><label><input aria-label={`تفعيل ${f.name}`} type="checkbox" checked={enabled[i]} onChange={()=>toggle(i)}/><i/></label></div>)}</div></section>
        <section className="panel live-panel"><div className="panel-head"><div><small>مباشر</small><h2>النشاط الآن</h2></div><span className="live-status"><i/> حي</span></div><div className="live-number"><b>614</b><span>مستخدم متصل الآن</span><div className="bars">{[26,39,31,54,44,63,56,71,62,82,73,94,78,66,72,58,64,51,59,45].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div><div className="live-breakdown"><div><span>◉ متابعة الاسم</span><b>184</b></div><div><span>▣ مراقبة الشاشة</span><b>132</b></div><div><span>♧ المزرعة</span><b>86</b></div><div><span>◎ جلسات التركيز</span><b>212</b></div></div></section>
      </div>

      <div className="admin-grid lower">
        <section className="panel"><div className="panel-head"><div><small>البنية التحتية</small><h2>الأجهزة والحساسات</h2></div><button onClick={()=>setSection("الأجهزة")}>عرض الأجهزة ←</button></div><div className="device-ring"><div className="ring"><span><b>98.7%</b><small>متصل</small></span></div><div className="device-stats"><div><i className="ok"/><span>متصل</span><b>1,378</b></div><div><i className="warn"/><span>ضعيف</span><b>12</b></div><div><i className="off"/><span>غير متصل</span><b>6</b></div></div></div></section>
        <section className="panel"><div className="panel-head"><div><small>آخر الأحداث</small><h2>سجل النظام</h2></div><button onClick={()=>setSection("سجل النظام")}>السجل الكامل ←</button></div><div className="log-list">{[["✓","اكتملت دفعة التنبيهات","4,815 تنبيهًا · بدون أخطاء","منذ دقيقتين"],["✦","تحديث نموذج التعرّف الصوتي","الإصدار 2.4.1 يعمل الآن","منذ 18 دقيقة"],["⌁","اتصال أجهزة جديد","24 حساسًا من مزرعة الروضة","منذ 31 دقيقة"],["!","إشارة ضعيفة","12 جهازًا يحتاج الفحص","منذ ساعة"]].map((l,i)=><div className="log-row" key={l[1]}><span className={`log-icon l${i}`}>{l[0]}</span><div><b>{l[1]}</b><small>{l[2]}</small></div><time>{l[3]}</time></div>)}</div></section>
      </div>
    </section>
  </main>;
}
