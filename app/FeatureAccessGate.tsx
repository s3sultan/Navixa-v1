"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isFeatureAccessActive, type FeatureAccessSession } from "./featureAccess";
import "./feature-access.css";

type AccountSession = FeatureAccessSession & {
  user?: { email?: string } | null;
};

type Props = {
  children: ReactNode;
  feature?: string;
};

export default function FeatureAccessGate({ children, feature = "مزايا NAVIXA" }: Props) {
  const [session, setSession] = useState<AccountSession | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/session", { cache: "no-store" })
      .then(response => response.json())
      .then((value: AccountSession) => { if (active) setSession(value); })
      .catch(() => { if (active) setSession({ enabled: false, signedIn: false }); });
    return () => { active = false; };
  }, []);

  if (session && isFeatureAccessActive(session)) return <>{children}</>;

  const signedIn = session?.signedIn === true;
  const unavailable = session?.enabled === false;
  const title = unavailable
    ? "الحسابات غير متاحة مؤقتًا"
    : signedIn
      ? "فعّل وصولك أولًا"
      : "سجّل دخولك لتبدأ";
  const description = unavailable
    ? "نجهّز الدخول الآمن الآن. تبقى الصفحات التعريفية متاحة، بينما المزايا الشخصية تنتظر حتى يكتمل إعداد الحساب."
    : signedIn
      ? `تحتاج ${feature} إلى تجربة NAVIXA أو اشتراك فعّال. لا نفتح الميكروفون أو مشاركة الشاشة أو بياناتك قبل تفعيل حسابك.`
      : `تحتاج ${feature} إلى دخول آمن بالبريد ثم تفعيل تجربة NAVIXA أو اشتراكك. لا توجد كلمة مرور، ولا نطلب صلاحيات جهازك قبل ذلك.`;
  const href = unavailable ? "/plus" : signedIn ? "/plus" : "/account";
  const label = unavailable ? "اعرف حالة Plus" : signedIn ? "فعّل حسابي" : "دخول أو إنشاء حساب";

  return <section className="feature-access-gate" dir="rtl" aria-live="polite" aria-busy={!session}>
    <div className="feature-access-symbol" aria-hidden="true">⌾</div>
    <div className="feature-access-copy">
      <small>NAVIXA SA · وصول شخصي</small>
      <h1>{session ? title : "جارٍ التحقق من وصولك"}</h1>
      <p>{session ? description : "نراجع حالة حسابك بأمان قبل عرض أدواتك الشخصية."}</p>
      <div className="feature-access-actions">
        <a href={href}>{session ? label : "دخول أو إنشاء حساب"} <span>←</span></a>
        {signedIn && <a className="feature-access-secondary" href="/account">فتح حسابي</a>}
      </div>
      <p className="feature-access-note">يبقى الشرح العام وسياسة الخصوصية متاحين. لا يتم تشغيل أي ميزة أو طلب إذن من الجهاز قبل الدخول والتفعيل.</p>
    </div>
  </section>;
}
