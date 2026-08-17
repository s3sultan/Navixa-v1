"use client";

import { useEffect, useState } from "react";

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const response = await fetch("/api/auth/admin-session", { cache: "no-store", credentials: "same-origin" });
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && result.authenticated === true) {
          setAllowed(true);
          setChecking(false);
          return;
        }
      } catch { /* The server route guard will also reject direct navigation. */ }
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
