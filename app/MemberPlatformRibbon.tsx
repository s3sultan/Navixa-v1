"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeatureAccessSession } from "./featureAccess";

export const hasPaidPlatformAccess = (session: FeatureAccessSession | null | undefined) =>
  session?.signedIn === true && session?.plus?.status === "active";

export default function MemberPlatformRibbon() {
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/account/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((session: FeatureAccessSession | null) => {
        if (active) setIsEligible(hasPaidPlatformAccess(session));
      })
      .catch(() => { if (active) setIsEligible(false); });
    return () => { active = false; };
  }, []);

  if (!isEligible) return null;

  return <aside className="member-platform-ribbon" aria-label="عالم NAVIXA للمشتركين">
    <Link className="member-platform-ribbon-head" href="/projects">
      <span aria-hidden="true">✦</span>
      <b>عالم NAVIXA</b>
      <small>خدمات إضافية مشمولة مع اشتراكك Plus</small>
      <em>استكشف مشاريعك <i aria-hidden="true">←</i></em>
    </Link>
  </aside>;
}
