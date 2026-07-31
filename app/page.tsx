"use client";

import { useMemo, useState } from "react";

const zones = [
  { name: "المنطقة الشرقية", plant: "طماطم كرزية", moisture: 64, status: "مثالي", icon: "🍅", color: "#ff796b" },
  { name: "البيت الزجاجي", plant: "ريحان ونعناع", moisture: 48, status: "ريّ قريب", icon: "🌿", color: "#78c091" },
  { name: "الحوض الجنوبي", plant: "فلفل حلو", moisture: 71, status: "مثالي", icon: "🫑", color: "#f0c76e" },
];

export default function Home() {
  const [automation, setAutomation] = useState(true);
  const [irrigating, setIrrigating] = useState(false);
  const [activeNav, setActiveNav] = useState("نظرة عامة");
  const [toast, setToast] = useState("");
  const greeting = useMemo(() => new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير", []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <main dir="rtl" className="app-shell">
      {toast && <div className="toast">✓ {toast}</div>}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><div><strong>NAVIXA</strong><small>SMART GARDEN</small></div></div>
        <nav>
          <p className="nav-label">لوحة التحكم</p>
          {["نظرة عامة", "مناطق الزراعة", "جدول الري", "الأتمتة", "التحليلات"].map((item, i) => (
            <button key={item} onClick={() => {setActiveNav(item); notify(`تم فتح ${item}`)}} className={activeNav === item ? "active" : ""}>
              <span>{["⌂", "♧", "◉", "⌁", "⌁"][i]}</span>{item}{item === "الأتمتة" && <b>4</b>}
            </button>
          ))}
          <p className="nav-label support">النظام</p>
          <button onClick={() => notify("لا توجد تنبيهات حرجة")}><span>♢</span>التنبيهات<b className="alert-badge">2</b></button>
          <button onClick={() => notify("الإعدادات جاهزة")}><span>⚙</span>الإعدادات</button>
        </nav>
        <div className="system-card"><span className="live-dot"/><div><strong>النظام متصل</strong><small>آخر تحديث: الآن</small></div></div>
        <div className="profile"><div className="avatar">م</div><div><strong>مزرعة محمد</strong><small>مدير النظام</small></div><button>⋮</button></div>
      </aside>

      <section className="content">
        <header>
          <div><p className="eyebrow">{greeting}، محمد 👋</p><h1>حديقتك تنمو بذكاء.</h1><p>كل شيء يعمل تلقائيًا. استمتع بالمشهد واترك الباقي لنا.</p></div>
          <div className="header-actions"><button className="icon-btn" onClick={() => notify("لا توجد إشعارات جديدة")}>♢<i/></button><button className="weather"><span>☀</span><div><b>28°</b><small>الرياض، مشمس</small></div></button></div>
        </header>

        <section className="hero-grid">
          <div className="garden-visual">
            <div className="sun">☀</div><div className="cloud c1">☁</div><div className="cloud c2">☁</div>
            <div className="sky-title"><span className="live-pill">● مباشر</span><p>حالة الحديقة</p><h2>كل شيء على ما يرام</h2></div>
            <div className="garden-bed"><span>🌳</span><span>🌿</span><span>🌱</span><span>🌳</span><span>🌱</span></div>
            <div className="scene-stats"><div><small>رطوبة التربة</small><b>64%</b><span>ممتازة</span></div><div><small>درجة الحرارة</small><b>28°</b><span>معتدلة</span></div><div><small>استهلاك اليوم</small><b>42L</b><span>−18% توفير</span></div></div>
          </div>
          <div className="automation-card">
            <div className="automation-head"><span className="auto-icon">✦</span><div><p>المساعد الذكي</p><h3>الأتمتة الكاملة</h3></div><label className="switch"><input aria-label="تشغيل الأتمتة" type="checkbox" checked={automation} onChange={() => {setAutomation(!automation); notify(!automation ? "تم تشغيل الأتمتة" : "تم إيقاف الأتمتة")}}/><span/></label></div>
            <div className="auto-status"><span className={automation ? "pulse" : "off-dot"}/><div><b>{automation ? "النظام يعمل الآن" : "النظام متوقف مؤقتًا"}</b><small>{automation ? "نراقب 12 حساسًا ونُدير 4 مهام" : "يمكنك التحكم يدويًا بالمناطق"}</small></div></div>
            <div className="next-action"><p>الإجراء القادم</p><div><span className="drop">♢</span><div><b>ريّ المنطقة الشرقية</b><small>اليوم، 06:30 مساءً · 12 دقيقة</small></div><em>بعد ساعتين</em></div></div>
            <button className="manage" onClick={() => notify("تم فتح قواعد الأتمتة")}>إدارة قواعد الأتمتة <span>←</span></button>
          </div>
        </section>

        <section className="metrics">
          <div><span className="metric-icon blue">♢</span><p>المياه الموفّرة<small>هذا الشهر</small></p><b>1,240 <small>لتر</small></b><em>↑ 24%</em></div>
          <div><span className="metric-icon green">♧</span><p>صحة النباتات<small>متوسط كل المناطق</small></p><b>94<small>%</small></b><em>ممتاز</em></div>
          <div><span className="metric-icon orange">☀</span><p>الطاقة الشمسية<small>إنتاج اليوم</small></p><b>3.8 <small>kWh</small></b><em>↑ 12%</em></div>
          <div><span className="metric-icon purple">⌁</span><p>المهام الآلية<small>آخر 7 أيام</small></p><b>38</b><em>بدون أخطاء</em></div>
        </section>

        <div className="section-heading"><div><h2>مناطق الزراعة</h2><p>نظرة سريعة على حالة كل منطقة</p></div><button onClick={() => notify("تم عرض جميع المناطق")}>عرض كل المناطق ←</button></div>
        <section className="zones">
          {zones.map((z, i) => <article className="zone-card" key={z.name}>
            <div className="zone-top"><span className="plant-icon" style={{background: `${z.color}22`}}>{z.icon}</span><span className={i === 1 ? "status pending" : "status"}>● {z.status}</span><button aria-label={`خيارات ${z.name}`}>⋮</button></div>
            <h3>{z.name}</h3><p>{z.plant}</p>
            <div className="moisture"><div><span>رطوبة التربة</span><b>{z.moisture}%</b></div><div className="bar"><i style={{width: `${z.moisture}%`}}/></div></div>
            <div className="zone-info"><span>🌡 26°</span><span>♢ {i === 1 ? "بعد 45 د" : "بعد ساعتين"}</span></div>
            <button className="irrigate" onClick={() => {setIrrigating(true); notify(`بدأ ري ${z.name}`); window.setTimeout(() => setIrrigating(false), 2500)}}>{irrigating ? "جارٍ الري..." : "ري الآن"}</button>
          </article>)}
          <button className="add-zone" onClick={() => notify("جاهز لإضافة منطقة جديدة")}><span>＋</span><b>إضافة منطقة جديدة</b><small>اربط حساسًا وابدأ الأتمتة</small></button>
        </section>

        <section className="bottom-grid">
          <div className="activity"><div className="section-heading"><div><h2>آخر النشاطات</h2><p>ما قام به النظام مؤخرًا</p></div><button onClick={() => notify("تم فتح سجل النشاطات")}>السجل الكامل ←</button></div>
            {[["♢","اكتمل الري بنجاح","البيت الزجاجي · 18 لتر","منذ 32 دقيقة","blue"],["✦","تم تعديل الجدول تلقائيًا","توقع أمطار غدًا · تم تخطي الري","منذ ساعة","purple"],["⚠","رطوبة منخفضة","المنطقة الشرقية · 48%","منذ ساعتين","orange"]].map(a => <div className="activity-row" key={a[1]}><span className={`activity-icon ${a[4]}`}>{a[0]}</span><div><b>{a[1]}</b><small>{a[2]}</small></div><time>{a[3]}</time></div>)}
          </div>
          <div className="quick"><div><h2>تحكم سريع</h2><p>إجراءات يدوية فورية</p></div><button onClick={() => {setIrrigating(true); notify("بدأ ري جميع المناطق"); window.setTimeout(() => setIrrigating(false),2500)}}><span>♢</span><div><b>{irrigating ? "الري يعمل الآن" : "ري جميع المناطق"}</b><small>لمدة 10 دقائق</small></div><i>←</i></button><button onClick={() => notify("تم إيقاف جميع الصمامات بأمان")}><span className="red">■</span><div><b>إيقاف طارئ</b><small>إيقاف كل الأنظمة</small></div><i>←</i></button></div>
        </section>
      </section>
    </main>
  );
}
