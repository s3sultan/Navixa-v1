"use client";

import { useEffect, useState } from "react";

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      // تعطي متصفحات الجوال فرصة قصيرة لتثبيت Cookie الآمنة بعد العودة من Google.
      for (const delay of [0, 220, 620]) {
        if (delay) await wait(delay);
        try {
          const response = await fetch(`/api/auth/admin-session?fresh=${Date.now()}`, {
            cache: "no-store",
            credentials: "same-origin",
            headers: { "cache-control": "no-cache" },
          });
          const result = await response.json().catch(() => ({}));
          if (!active) return;
          if (response.ok && result.authenticated === true) {
            setAllowed(true);
            setChecking(false);
            return;
          }
        } catch { /* الحارس الخادمي يبقى المرجع النهائي عند فشل الشبكة. */ }
      }

      if (!active) return;
      setAllowed(false);
      setChecking(false);
      window.location.replace("/admin/login?reason=session");
    };

    void verify();
    return () => { active = false; };
  }, []);

  return { allowed, checking };
}
