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

type ProductKey = typeof products[number]["key"];
type Entitlements = Record<ProductKey, Membership>;

function PortfolioContent() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(products.map(async product => {
      try {
        const response = await fetch(`/api/portfolio/membership?app=${product.key}`, { cache: "no-store" });
        const value = await response.json() as Membership;
        return [product.key, value] as const;
      } catch {
        return [product.key, { eligible: false }] as const;
      }
    })).then(entries => {
      if (active) setEntitlements(Object.fromEntries(entries) as Entitlements);
    });
    return () => { active = false; };
  }, []);

  const membership = entitlements ? Object.values(entitlements).find(value => value.eligible) : undefined;
  const statusText = membership?.status === "trial" ? "تجربة NAVIXA نشطة" : "اشتراك NAVIXA نشط";
  const ending = membership?.endsAt ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(membership.endsAt)) : "";
  const membershipText = !entitlements ? "جارٍ التحقق من عضويتك" : membership ? statusText : "لا توجد صلاحية مشاريع نشطة";

  return <main className="portfolio-page" dir="rtl">
    <section className="portfolio-hero">
      <p className="portfolio-kicker">NAVIXA SA · منظومة واحدة</p>
      <h1>حساب واحد، مسارات أكثر.</h1>
      <p>تدخل من NAVIXA مرة واحدة، ثم تتابع ما يناسب يومك من دون إعادة تسجيل أو كشف بيانات حسابك بين المواقع.</p>
      <div className="portfolio-membership"><span aria-hidden="true">✓</span><div><b>{membershipText}</b>{ending && <small>صلاحية الوصول حتى {ending}</small>}</div></div>
    </section>

    <section className="portfolio-grid" aria-label="مواقع منظومة NAVIXA">
      {products.map(product => {
        const entitlement = entitlements?.[product.key];
        const checking = !entitlements;
        return <article className="portfolio-product" key={product.key}>
          <span className="portfolio-product-mark" aria-hidden="true">{product.mark}</span>
          <p>{product.eyebrow}</p>
          <h2>{product.name}</h2>
          <span>{product.description}</span>
          {entitlement?.eligible
            ? <a href={`/api/portfolio/authorize?app=${product.key}`}>فتح الموقع <b aria-hidden="true">←</b></a>
            : <span aria-live="polite">{checking ? "جارٍ التحقق من الصلاحية…" : "غير مشمول بعضويتك"}</span>}
        </article>;
      })}
    </section>

    <p className="portfolio-note">عند انتهاء التجربة أو الاشتراك، تتوقف صلاحية هذه المواقع تلقائيًا، بينما تبقى الصفحات والمحتوى المجاني في NAVIXA الأساسي متاحين لك.</p>
  </main>;
}

export default function PortfolioPage() {
  return <FeatureAccessGate feature="منظومة NAVIXA"><PortfolioContent /></FeatureAccessGate>;
}
