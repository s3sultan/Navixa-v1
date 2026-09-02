import "./preview.css";

type IconName = "headphones" | "shield" | "spark" | "heart" | "book" | "child" | "fitness";

function Icon({ name }: { name: IconName }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "headphones") return <svg {...common}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 14v3a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2Z"/><path d="M20 14v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2Z"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/><path d="M9 12h6"/><path d="m12 9 3 3-3 3"/></svg>;
  if (name === "spark") return <svg {...common}><path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z"/></svg>;
  if (name === "heart") return <svg {...common}><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>;
  if (name === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></svg>;
  if (name === "child") return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M6.5 20c.8-4 2.7-6 5.5-6s4.7 2 5.5 6"/><path d="M8.5 5.5 7 4"/><path d="M15.5 5.5 17 4"/></svg>;
  return <svg {...common}><path d="M6 7v10"/><path d="M18 7v10"/><path d="M3 10v4"/><path d="M21 10v4"/><path d="M6 12h12"/></svg>;
}

const features = [
  { icon: "headphones" as const, kicker: "استمع", title: "استمع ولخّص", text: "يتابع المحاضرة أو الاجتماع، يقسّم المحتوى بذكاء، ثم يجمع أهم النقاط والقرارات في نهاية الجلسة." },
  { icon: "shield" as const, kicker: "راقب", title: "راقب ونبّهني", text: "راقب جزءًا من الشاشة أو الكلمات المهمة، ودع NAVIXA ينبهك عندما يحدث ما يستحق انتباهك." },
  { icon: "spark" as const, kicker: "افهم", title: "ذكاء NAVIXA", text: "مساعد يفهم يومك، يحول الكلام إلى مهام ومواعيد، ويربط الأدوات دون ازدحام أو خطوات كثيرة." },
];

const projects = [
  { icon: "child" as const, name: "NAVIXA Kids", text: "تعلم ممتع وآمن للأطفال" },
  { icon: "book" as const, name: "English Learning", text: "تعلم الإنجليزية بخطوات واضحة" },
  { icon: "fitness" as const, name: "NAVIXA Fitness", text: "حركة وتمارين تناسب يومك" },
  { icon: "heart" as const, name: "صحتي", text: "صحة مكتبية، ماء وحركة وجلوس أفضل" },
];

export default function DesignPreviewPage() {
  return (
    <main className="preview-shell" dir="rtl">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="preview-nav">
        <a className="brand" href="#top" aria-label="NAVIXA">
          <span className="brand-mark">N</span>
          <span className="brand-copy"><b>NAVIXA</b><small>يفهم يومك</small></span>
        </a>
        <nav aria-label="معاينة أقسام الصفحة">
          <a href="#features">المميزات</a>
          <a href="#ecosystem">المنظومة</a>
          <span className="preview-pill">معاينة فقط</span>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">مساحتك الذكية، بهدوء</span>
          <h1>ثلاثة أشياء مهمة.<br/><span>وكل يومك حولها.</span></h1>
          <p>واجهة NAVIXA أخف وأوضح، تضع الاستماع والمراقبة والذكاء في الواجهة، ثم تترك بقية المنظومة قريبة بدون أن تزاحمك.</p>
          <div className="hero-actions">
            <a className="primary-action" href="#features">استكشف المميزات <span aria-hidden="true">←</span></a>
            <a className="quiet-action" href="#ecosystem">شاهد المنظومة</a>
          </div>
        </div>

        <div className="hero-panel" aria-label="نظرة سريعة على NAVIXA">
          <div className="panel-top"><span>الآن</span><strong>مساحتك اليومية</strong></div>
          <div className="signal-card signal-main">
            <div className="icon-box"><Icon name="headphones"/></div>
            <div><small>الاستماع نشط</small><b>متابعة المحاضرة</b><span>27 دقيقة تم تلخيصها</span></div>
            <span className="live-dot" aria-label="نشط"/>
          </div>
          <div className="mini-grid">
            <div className="signal-card"><div className="icon-box"><Icon name="shield"/></div><div><small>المراقبة</small><b>جاهز للتنبيه</b></div></div>
            <div className="signal-card"><div className="icon-box"><Icon name="spark"/></div><div><small>المساعد</small><b>3 مهام مستخرجة</b></div></div>
          </div>
          <div className="today-line"><span>اليوم</span><div className="progress-track"><i/></div><strong>68%</strong></div>
        </div>
      </section>

      <section className="feature-section" id="features">
        <div className="section-heading"><div><span>الأساس</span><h2>أهم ما في NAVIXA أمامك</h2></div><p>بدل شبكة طويلة من الأدوات، تبدأ الرحلة بثلاث قدرات رئيسية واضحة، ثم تكشف التفاصيل عند الحاجة.</p></div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className={`feature-card feature-${index + 1}`} key={feature.title}>
              <div className="feature-icon"><Icon name={feature.icon}/></div>
              <span className="feature-kicker">{feature.kicker}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <span className="feature-link">افتح الميزة <b aria-hidden="true">←</b></span>
            </article>
          ))}
        </div>
      </section>

      <section className="ecosystem" id="ecosystem">
        <div className="section-heading compact"><div><span>منظومة واحدة</span><h2>NAVIXA معك في أكثر من مساحة</h2></div></div>
        <div className="project-rail">
          {projects.map((project) => (
            <article className="project-card" key={project.name}>
              <div className="project-icon"><Icon name={project.icon}/></div>
              <div><strong>{project.name}</strong><span>{project.text}</span></div>
              <b className="project-arrow" aria-hidden="true">←</b>
            </article>
          ))}
        </div>
      </section>

      <section className="preview-note">
        <div><span>تصميم تجريبي</span><h2>هذه المعاينة منفصلة عن الموقع الحالي.</h2></div>
        <p>لا تسجيل دخول، لا اشتراكات، لا قواعد بيانات، ولا تغيير على واجهة الإنتاج. الهدف هنا اعتماد الشكل فقط قبل أي دمج.</p>
      </section>
    </main>
  );
}
