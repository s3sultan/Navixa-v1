"use client";

import { useEffect, useState } from "react";

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("unauthorized");
        if (active) setAllowed(true);
      })
      .catch(() => {
        window.location.replace("/admin/login");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  return { allowed, checking };
}
