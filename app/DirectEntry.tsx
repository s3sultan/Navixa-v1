"use client";

import { useEffect } from "react";

/**
 * Temporary public-trial entry mode.
 * Keeps the existing welcome/account implementation intact so it can be
 * restored later, while visitors enter NAVIXA directly without registration.
 */
export default function DirectEntry() {
  useEffect(() => {
    try {
      localStorage.setItem("navixa-welcome-hidden", "1");
      localStorage.setItem("navixa-entered", "1");
      sessionStorage.setItem("navixa-entered", "1");
    } catch {}

    document.documentElement.dataset.navixaDirectEntry = "true";
    return () => { delete document.documentElement.dataset.navixaDirectEntry; };
  }, []);

  return <style>{`
    html[data-navixa-direct-entry="true"] .welcome-screen,
    html[data-navixa-direct-entry="true"] .welcome-overlay,
    html[data-navixa-direct-entry="true"] .welcome-gate,
    html[data-navixa-direct-entry="true"] .entry-gate,
    html[data-navixa-direct-entry="true"] .auth-gate { display:none !important; }
  `}</style>;
}
