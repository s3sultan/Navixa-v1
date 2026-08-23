"use client";

import { useEffect, useState } from "react";

export default function NavixaSplash() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const beginExit = window.setTimeout(() => setLeaving(true), 520);
    const finish = window.setTimeout(() => setVisible(false), 900);
    return () => { window.clearTimeout(beginExit); window.clearTimeout(finish); };
  }, []);

  if (!visible) return null;
  return <div className={`navixa-splash${leaving ? " leaving" : ""}`} role="status" aria-label="جارٍ فتح NAVIXA SA">
    <div className="navixa-splash-orbit" aria-hidden="true" />
    <div className="navixa-splash-brand">
      <img src="/navixa-mark.webp" alt="" />
      <div className="navixa-splash-wordmark"><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b></div>
      <p>مساعدك الذكي، حاضر في التفاصيل التي تهمك</p>
    </div>
  </div>;
}
