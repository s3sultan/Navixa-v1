"use client";

import { useEffect, useState } from "react";
import { clearAdminToken, readAdminToken, verifyGoogleAdminToken } from "./localAuth";

export function useAdminAuth() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const deny = () => {
      if (!active) return;
      clearAdminToken();
      setChecking(false);
      window.location.replace("/admin/login?reason=session");
    };

    const verify = async () => {
      const token = readAdminToken();
      if (!token) {
        deny();
        return;
      }

      const verified = await verifyGoogleAdminToken(token);
      if (!active) return;
      if (!verified.ok) {
        deny();
        return;
      }

      setAllowed(true);
      setChecking(false);
    };

    void verify();
    return () => { active = false; };
  }, []);

  return { allowed, checking };
}
