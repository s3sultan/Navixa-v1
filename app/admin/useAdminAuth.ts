"use client";

import { useEffect, useState } from "react";

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const deny = () => {
      if (!active) return;
      setChecking(false);
      window.location.replace("/admin/login?reason=session");
    };

    const verify = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) {
          if (active) {
            setAllowed(true);
            setChecking(false);
          }
          return;
        }

        if (response.status === 503 && attempts < 2) {
          attempts += 1;
          retryTimer = setTimeout(verify, attempts * 700);
          return;
        }

        deny();
      } catch {
        if (attempts < 2) {
          attempts += 1;
          retryTimer = setTimeout(verify, attempts * 700);
          return;
        }
        deny();
      }
    };

    void verify();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return { allowed, checking };
}
