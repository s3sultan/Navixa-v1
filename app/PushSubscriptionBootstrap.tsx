"use client";

import { useEffect } from "react";
import { syncExistingNavixaPushSubscription } from "./pushClient";

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 1500;

export default function PushSubscriptionBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let lastAttempt = 0;
    let timer: number | null = null;

    const sync = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = Date.now();
      if (now - lastAttempt < RESYNC_INTERVAL_MS) return;
      lastAttempt = now;
      void syncExistingNavixaPushSubscription();
    };

    timer = window.setTimeout(sync, INITIAL_DELAY_MS);
    const onPageShow = () => sync();
    const onVisibility = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
