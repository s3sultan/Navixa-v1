"use client";

import { useState } from "react";

const areas = [
  { name: "الحقل الشرقي", plants: "طماطم · ريحان", moisture: 62, next: "ري تلقائي 6:30 م", icon: "🌿", tone: "mint" },
  { name: "البيت المحمي", plants: "نعناع · فلفل", moisture: 48, next: "ري تلقائي بعد 45 د", icon: "🪴", tone: "sand" },
  { name: "بستان الأشجار", plants: "ليمون · زيتون", moisture: 74, next: "لا يحتاج ري اليوم", icon: "🌳", tone: "blue" },
];

export default function Home() {
  const [auto, setAuto] = useState(true);
  const [toast, setToast] = useState("");
  const [active, setActive] = useState("الرئيسية");
  const [watering, setWatering] = useState(false);
  const say = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2400); };

  return <main dir="rtl" className="shell">
    {toast && <div className="toast">✓ {toast}</div>}
    <aside>
      <div className="logo"><span>ن</span><div><b>NAVIXA</b><small>المساعد الذكي</small></div></div>
      <nav>
        {["الرئيسية", "مزرعتي", "الأتمتة", "المهام", "التقارير"].map((x, i) => <button key={x} className={active === x ? "on" : ""} onClick={() => {setActive(x); say(`تم فتح ${x}`)}}><i>{["⌂","♧","✦","✓","⌁"][i]}</i>{x}{x === "المهام" && <em>2</em>}</button>)}
      </nav>
      <div className="side-bottom"><button onClick={() => say("تم فتح الإعدادات")}>⚙ الإعدادات</button><div className="user"><span>م</span><div><b>محمد</b><small>مزرعة الروضة</small></div><i>⋮</i></div></div>
    </aside>

    <section className="page">
      <header><div className="mobile-logo">N</div><div><small>الخميس، 31 يوليو</small><h1>هلا محمد، حديقتك بخير 🌱</h1></div><div className="head-actions"><button onClick={() => say("لا توجد تنبيهات جديدة")}>♢<i/></button><span className="weather">☀ <b>28°</b><small>الرياض</small></span></div></header>

      <section className="explain">
        <div><span className="kicker">NAVIXA · ذكاء ينفّذ عنك</span><h2>أنت تزرع، <strong>ونفكسا يهتم بالباقي.</strong></h2><p>من حديقة المنزل إلى المزرعة: نفكسا يراقب كل منطقة، يفهم احتياج المحاصيل، ويتخذ القرار وينفّذه تلقائيًا — بدون جداول معقدة أو متابعة يومية.</p><div className="concept"><span>الحساسات تقرأ</span><i>←</i><span>نفكسا يفهم ويقرر</span><i>←</i><span>التنفيذ تلقائي</span></div></div>
        <div className="plant-scene"><span className="sun">☀</span><span className="cloud">☁</span><div className="plant">🌱</div><div className="soil"><i/><i/><i/></div><div className="sensor"><b>62%</b><small>رطوبة ممتازة</small></div></div>
      </section>

      <section className="now">
        <div className="section-title"><div><span>الآن</span><h2>وش قاعد يصير في حديقتك؟</h2></div><p><i/> جميع الأجهزة متصلة</p></div>
        <div className="now-grid">
          <article className="status-card"><div className="status-top"><span className="auto-mark">✦</span><div><small>نفكسا يدير المزرعة</small><h3>{auto ? "الأتمتة تعمل" : "التحكم اليدوي"}</h3></div><label><input aria-label="تشغيل الأتمتة" type="checkbox" checked={auto} onChange={() => {setAuto(!auto);say(!auto ? "رجعت الأتمتة للعمل" : "تم التحويل للتحكم اليدوي")}}/><i/></label></div><p>{auto ? "لا تحتاج تسوي شيء الآن. النظام يراقب الرطوبة والطقس ويتصرف تلقائيًا." : "الأتمتة متوقفة مؤقتًا. يمكنك ري المناطق يدويًا."}</p><div className="next"><span>♢</span><div><small>الخطوة القادمة</small><b>ري البيت المحمي · بعد 45 دقيقة</b></div><em>12 دقيقة</em></div></article>
          <article className="attention"><div className="attention-title"><span>!</span><div><small>يحتاج انتباهك</small><h3>مهمتان بسيطتان</h3></div></div><button onClick={() => say("تمت إضافة السماد إلى مهامك")}><span className="task-icon">🧴</span><div><b>خزان السماد قرب يخلص</b><small>متبقي تقريبًا 15%</small></div><i>←</i></button><button onClick={() => say("تم تأجيل تنظيف الحساس ليوم الأحد")}><span className="task-icon">◌</span><div><b>تنظيف حساس الرطوبة</b><small>المنطقة الخارجية · هذا الأسبوع</small></div><i>←</i></button></article>
        </div>
      </section>

      <section className="summary">
        <article><span className="drop">♢</span><div><small>وفّرت هذا الشهر</small><b>1,240 <em>لتر ماء</em></b></div><i>أكثر بـ 24% ↑</i></article>
        <article><span className="heart">♡</span><div><small>صحة الحديقة</small><b>94<em>%</em></b></div><i>ممتازة</i></article>
        <article><span className="bolt">ϟ</span><div><small>مهام تمت تلقائيًا</small><b>38 <em>مهمة</em></b></div><i>بدون تدخل منك</i></article>
      </section>

      <section className="garden">
        <div className="garden-head"><div><small>مزرعة الروضة</small><h2>كل منطقة في لمحة</h2></div><button onClick={() => say("تم فتح تفاصيل المزرعة")}>التفاصيل كاملة ←</button></div>
        <div className="area-grid">{areas.map((a, idx) => <article key={a.name} className="area"><div className={`area-image ${a.tone}`}><span>{a.icon}</span><em className={idx === 1 ? "soon" : "good"}>● {idx === 1 ? "ري قريب" : "ممتاز"}</em></div><div className="area-body"><h3>{a.name}</h3><p>{a.plants}</p><div className="reading"><span>رطوبة التربة</span><b>{a.moisture}%</b></div><div className="meter"><i style={{width:`${a.moisture}%`}}/></div><div className="next-row"><span>♢</span><small>{a.next}</small></div><button onClick={() => {setWatering(true);say(`بدأ ري ${a.name}`);setTimeout(()=>setWatering(false),2500)}}>{watering ? "الري يعمل الآن..." : "ري الآن"}</button></div></article>)}
          <button className="add" onClick={() => say("جاهز لربط منطقة جديدة")}><span>＋</span><b>أضف منطقة</b><small>اربط الحساس وخلك مرتاح</small></button>
        </div>
      </section>

      <section className="ask"><span>✦</span><div><small>اسأل نفكسا</small><h2>“هل تحتاج حديقتي ري اليوم؟”</h2></div><button onClick={() => say("حديقتك بخير، البيت الزجاجي سيُروى تلقائيًا بعد 45 دقيقة")}>اسأل الآن ←</button></section>
    </section>
  </main>;
}
