"use client";

import { useEffect, useState } from "react";
import type { FeatureAccessSession } from "./featureAccess";

type AccountSession = FeatureAccessSession & {
  user?: { email?: string } | null;
};

export const platformAnnouncements = [
  {
    app: "learning",
    eyebrow: "NAVIXA Learning",
    title: "تعلّم بتركيز… وخطتك تمشي معك",
    detail: "مفردات وتحديات يومية وتجربة تعلّم عربية متدرجة.",
    cta: "افتح Learning",
    tone: "learning",
  },
  {
    app: "fitness",
    eyebrow: "NAVIXA Fitness",
    title: "خطوتك القادمة تبدأ من طاقتك",
    detail: "مساحة لروتينك الصحي وتقدّمك اليومي بوضوح.",
    cta: "افتح Fitness",
    tone: "fitness",
  },
  {
    app: "kids",
    eyebrow: "NAVIXA Kids",
    title: "تعلّم صغيرهم… بفضول وفرح",
    detail: "أنشطة مناسبة للأطفال تجمع اللعب بالتعلّم الهادئ.",
    cta: "افتح Kids",
    tone: "kids",
  },
] as const;

export const hasPaidPlatformAccess = (session: FeatureAccessSession | null | undefined) =>
  session?.signedIn === true && session?.plus?.status === "active";

export default function MemberPlatformRibbon() {
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/account/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((session: AccountSession | null) => {
        if (active) setIsEligible(hasPaidPlatformAccess(session));
      })
      .catch(() => { if (active) setIsEligible(false); });
    return () => { active = false; };
  }, []);

  if (!isEligible) return null;

  return <aside className="member-platform-ribbon" aria-label="منصات NAVIXA المتاحة لعضويتك">
    <div className="member-platform-ribbon-head">
      <span aria-hidden="true">✦</span>
      <b>منظومة NAVIXA لك</b>
      <small>عضويتك النشطة تفتح لك الوصول الموحد</small>
    </div>
    <div className="member-platform-ribbon-viewport">
      <div className="member-platform-ribbon-track">
        {[0, 1].map((loop) => <div className="member-platform-ribbon-set" key={loop} aria-hidden={loop === 1}>
          {platformAnnouncements.map((announcement) => <div className="member-platform-ribbon-group" key={`${announcement.app}-${loop}`}>
            <a
              className={`member-platform-promo tone-${announcement.tone}`}
              href={`/api/portfolio/authorize?app=${announcement.app}`}
              tabIndex={loop === 1 ? -1 : 0}
            >
              <span className="member-platform-promo-eyebrow">{announcement.eyebrow}</span>
              <b>{announcement.title}</b>
              <small>{announcement.detail}</small>
              <em>{announcement.cta} <i aria-hidden="true">←</i></em>
            </a>
            <span className="member-platform-separator" aria-hidden="true">
              <img src="/navixa-mark.webp" alt="" />
              <b>NAVIXA <em>SA</em></b>
              <i />
            </span>
          </div>)}
        </div>)}
      </div>
    </div>
  </aside>;
}
