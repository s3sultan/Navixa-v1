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
  const [listening, setListening] = useState(true);
  const [screenWatch, setScreenWatch] = useState(true);
  const say = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2400); };

  return <main dir="rtl" className="shell">
    {toast && <div className="toast">✓ {toast}</div>}
    <aside>
      <div className="logo"><span>ن</span><div><b>NAVIXA</b><small>المساعد الذكي</small></div></div>
      <nav>
        {["الرئيسية", "مساعدي", "المزرعة", "الأتمتة", "المهام"].map((x, i) => <button key={x} className={active === x ? "on" : ""} onClick={() => {setActive(x); say(`تم فتح ${x}`)}}><i>{["⌂","◉","♧","✦","✓"][i]}</i>{x}{x === "المهام" && <em>2</em>}</button>)}
      </nav>
      <div className="side-bottom"><button onClick={() => say("تم فتح الإعدادات")}>⚙ الإعدادات</button><div className="user"><span>م</span><div><b>محمد</b><small>مزرعة الروضة</small></div><i>⋮</i></div></div>
    </aside>

    <section className="page">
      <header><div className="mobile-logo">N</div><div><small>الخميس، 31 يوليو</small><h1>هلا محمد، حديقتك بخير 🌱</h1></div><div className="head-actions"><button onClick={() => say("لا توجد تنبيهات جديدة")}>♢<i/></button><span className="weather">☀ <b>28°</b><small>الرياض</small></span></div></header>

      <section className="explain">
        <div><span className="kicker">NAVIXA · ذكاء حاضر معك</span><h2>يسمعك، يراقب مهامك، <strong>وينفّذ عنك.</strong></h2><p>مساعد واحد يجمع يومك ومزرعتك: ينبّهك عند سماع اسمك، يتابع الشاشة، يذكّرك بالمواعيد، ويدير الري والحساسات تلقائيًا.</p><div className="concept"><span>يسمع ويفهم</span><i>←</i><span>ينبّه ويقرر</span><i>←</i><span>ينفّذ تلقائيًا</span></div></div>
        <div className="plant-scene"><span className="sun">☀</span><span className="cloud">☁</span><div className="plant">🌱</div><div className="soil"><i/><i/><i/></div><div className="sensor"><b>62%</b><small>رطوبة ممتازة</small></div></div>
      </section>

      <section className="assistant-hub">
        <div className="garden-head"><div><small>مساعدي الذكي</small><h2>كل أدوات NAVIXA في مكان واحد</h2><p>شغّالة معك أثناء الدراسة، العمل والاجتماعات</p></div><button onClick={() => say("تم فتح كل أدوات المساعد")}>كل الأدوات ←</button></div>
        <div className="tools-grid">
          <article className="tool featured"><div className="tool-top"><span className="tool-icon mic">◉</span><label><input aria-label="متابعة نطق الاسم" type="checkbox" checked={listening} onChange={()=>{setListening(!listening);say(!listening?"بدأ NAVIXA الاستماع لاسمك":"توقفت متابعة الاسم")}}/><i/></label></div><h3>متابعة نطق الاسم</h3><p>ينبّهك فورًا عند سماع اسمك في الاجتماع أو المحاضرة.</p><div className="tool-live"><i className={listening?"wave":""}/> {listening ? "يستمع الآن لاسم: محمد" : "متوقف مؤقتًا"}</div></article>
          <article className="tool featured"><div className="tool-top"><span className="tool-icon screen">▣</span><label><input aria-label="مراقبة الشاشة" type="checkbox" checked={screenWatch} onChange={()=>{setScreenWatch(!screenWatch);say(!screenWatch?"بدأت مراقبة الشاشة":"توقفت مراقبة الشاشة")}}/><i/></label></div><h3>مراقبة الشاشة</h3><p>ينبّهك عند مغادرة الشاشة أو حدوث تغيير مهم فيها.</p><div className="tool-live"><i className={screenWatch?"safe":""}/> {screenWatch ? "الشاشة تحت المتابعة" : "المتابعة متوقفة"}</div></article>
          <article className="tool" onClick={()=>say("موعدك القادم: اجتماع الفريق 4:00 م")}><span className="tool-icon calendar">▦</span><h3>المواعيد والمهام</h3><p>تذكيرات ذكية لا تفوّت معها أي موعد.</p><b>اجتماع الفريق · 4:00 م</b></article>
          <article className="tool" onClick={()=>say("بدأت جلسة تركيز لمدة 25 دقيقة")}><span className="tool-icon focus">◎</span><h3>جلسة تركيز</h3><p>بومودورو ذكي مع تنبيهات الراحة.</p><b>ابدأ 25 دقيقة ←</b></article>
          <article className="tool" onClick={()=>say("تم فتح الملاحظات السريعة")}><span className="tool-icon notes">▤</span><h3>ملاحظات سريعة</h3><p>دوّن أفكارك وصدّرها في أي وقت.</p><b>3 ملاحظات محفوظة</b></article>
          <article className="tool" onClick={()=>say("تم فتح روابطك المثبتة")}><span className="tool-icon links">⌁</span><h3>روابط سريعة</h3><p>كل روابطك المهمة بضغطة واحدة.</p><b>8 روابط مثبتة</b></article>
        </div>
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
