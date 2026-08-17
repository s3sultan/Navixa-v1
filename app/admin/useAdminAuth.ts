"use client";

import { useEffect, useState } from "react";
import { clearAdminSession, readAdminSession } from "./adminSession";

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const session = readAdminSession();
    if (session) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    clearAdminSession();
    setChecking(false);
    window.location.replace("/admin/login?reason=session");
  }, []);

  return { allowed, checking };
}
