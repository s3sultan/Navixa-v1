"use client";

import { useEffect } from "react";

const sampledPaths = new Set(["/", "/health"]);

export default function PerformanceReporter() {
  useEffect(() => {
    const path = window.location.pathname;
    if (!sampledPaths.has(path) || Math.random() >= 0.1) return;

    const report = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!navigation) return;
      const ttfbMs = Math.round(navigation.responseStart - navigation.requestStart);
      const loadMs = Math.round((navigation.loadEventEnd || performance.now()) - navigation.startTime);
      if (ttfbMs < 0 || loadMs < 0 || loadMs > 120_000) return;

      const payload = JSON.stringify({ path, ttfbMs, loadMs });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/performance", new Blob([payload], { type: "application/json" }));
        return;
      }
      void fetch("/api/performance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "same-origin",
      });
    };

    if (document.readyState === "complete") report();
    else window.addEventListener("load", report, { once: true });
    return () => window.removeEventListener("load", report);
  }, []);

  return null;
}
