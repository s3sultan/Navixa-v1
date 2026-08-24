"use client";

import { useEffect, useState } from "react";
import FeatureAccessGate from "../FeatureAccessGate";
import "./portfolio.css";

type Membership = { eligible: boolean; status?: "trial" | "active"; plan?: string; endsAt?: string };

const products = [
  { key: "fitness", name: "NAVIXA Fitness", eyebrow: "حركة وصحة", description: "خطط مرنة ومتابعة صحية داخل تجربة NAVIXA الموحّدة.", mark: "✦" },
  { key: "kids", name: "NAVIXA Kids", eyebrow: "تعلم آمن للصغار", description: "مسارات قراءة وتعلّم مبسطة داخل بيئة عائلية مريحة.", mark: "◌" },
  { key: "learning", name: "NAVIXA Learning", eyebrow: "تعلّم الإنجليزية", description: "دروس قصيرة وتمارين وتقدم محفوظ ضمن مسار تعلّم واضح.", mark: "⌁" },
] as const;

function PortfolioContent() {
  const [membership, setMembership] = useState<Membership | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/portfolio/membership", { cache: "no-store" })
      .then(response => response.json())
      .then((value: Membership) => { if (active) setMembership(value); })
      .catch(() => { if (active) setMembership({ eligible: false }); });
    return () => { active = false; };
  }, []);

  const statusText = membership?.status === "trial" ? "تجربة NAVIXA نشطة" : "اشتراك NAVIXA نشط";
  const ending = membership?.endsAt ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(membership.endsAt)) : "";

  return <main className="portfolio-page" dir="rtl">
    <section className="portfolio-hero">
      <p className="portfolio-kicker">NAVIXA SA · منظومة واحدة</p>
      <h1>حساب واحد، مسارات أكثر.</h1>
      <p>تدخل من NAVIXA مرة واحدة، ثم تتابع ما يناسب يومك من دون إعادة تسجيل أو كشف بيانات حسابك بين المواقع.</p>
      <div className="portfolio-membership"><span aria-hidden="true">✓</span><div><b>{membership?.eligible ? statusText : "جارٍ التحقق من عضويتك"}</b>{ending && <small>صلاحية الوصول حتى {ending}</small>}</div></div>
    </section>

    <section className="portfolio-grid" aria-label="مواقع منظومة NAVIXA">
      {products.map(product => <article className="portfolio-product" key={product.key}>
        <span className="portfolio-product-mark" aria-hidden="true">{product.mark}</span>
        <p>{product.eyebrow}</p>
        <h2>{product.name}</h2>
        <span>{product.description}</span>
        <a href={`/api/portfolio/authorize?app=${product.key}`}>فتح الموقع <b aria-hidden="true">←</b></a>
      </article>)}
    </section>

    <p className="portfolio-note">عند انتهاء التجربة أو الاشتراك، تتوقف صلاحية هذه المواقع تلقائيًا، بينما تبقى الصفحات والمحتوى المجاني في NAVIXA الأساسي متاحين لك.</p>
  </main>;
}

export default function PortfolioPage() {
  return <FeatureAccessGate feature="منظومة NAVIXA"><PortfolioContent /></FeatureAccessGate>;
}
