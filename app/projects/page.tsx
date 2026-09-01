"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeatureAccessSession } from "../featureAccess";
import "./projects.css";

const projects = [
  { app: "kids", icon: "✦", name: "NAVIXA Kids", text: "مساحة طفلك للتعلّم والأنشطة بتجربة مستقلة وآمنة.", tag: "Kids" },
  { app: "learning", icon: "Aa", name: "NAVIXA English Learning", text: "تعلّم الإنجليزية بخطة واضحة وتقدّم خاص بك.", tag: "Learning" },
  { app: "fitness", icon: "↗", name: "NAVIXA Fitness", text: "روتينك وتدريبك وتقدّمك في مساحة مستقلة.", tag: "Fitness" },
] as const;

export default function ProjectsPage() {
  const [session, setSession] = useState<FeatureAccessSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/account/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(value => setSession(value))
      .catch(() => setSession(null))
      .finally(() => setLoaded(true));
  }, []);

  const eligible = session?.signedIn === true && session?.plus?.status === "active";

  return <main className="projects-world" dir="rtl">
    <div className="projects-shell">
      <Link className="projects-back" href="/">العودة إلى NAVIXA <span aria-hidden="true">←</span></Link>
      <header className="projects-hero">
        <div className="projects-orbit" aria-hidden="true"><span>✦</span></div>
        <p>هِمّة • عالمك في NAVIXA</p>
        <h1>عالم NAVIXA</h1>
        <h2>كل مشروع له مساحته. وحسابك يجمعهم.</h2>
        <small>مشاريع إضافية مرتبطة بعضويتك، بدون تشتيت الصفحة الرئيسية أو تسجيل دخول جديد.</small>
      </header>

      {!loaded && <div className="projects-state">جاري تجهيز عالمك…</div>}
      {loaded && !eligible && <section className="projects-state locked">
        <b>هذه المساحة مخصصة لعضوية هِمّة النشطة</b>
        <span>سجّل الدخول بحساب NAVIXA المشترك أو ارجع للصفحة الرئيسية.</span>
        <Link href="/account">حساب NAVIXA</Link>
      </section>}

      {eligible && <section className="projects-grid" aria-label="مشاريع NAVIXA المتاحة">
        {projects.map((project, index) => <a
          className={`project-card project-${project.app}`}
          href={`/api/portfolio/authorize?app=${project.app}`}
          key={project.app}
        >
          <div className="project-card-top">
            <span className="project-icon" aria-hidden="true">{project.icon}</span>
            <span className="project-status"><i /> مشمول مع هِمّة</span>
          </div>
          <span className="project-number">0{index + 1} • {project.tag}</span>
          <h3>{project.name}</h3>
          <p>{project.text}</p>
          <strong>فتح المشروع <span aria-hidden="true">←</span></strong>
        </a>)}
      </section>}

      {eligible && <footer className="projects-footnote">
        <span>🔐</span>
        <p><b>NAVIXA هو بوابة الصلاحية.</b> كل مشروع يفتح فقط وفق صلاحيات حسابك، وتبقى بياناتك وتقدمك داخله مستقلة.</p>
      </footer>}
    </div>
  </main>;
}
