"use client";

import { useEffect } from "react";

const sampledPaths = new Set(["/", "/health", "/organize-your-day", "/meeting-summaries", "/smart-reminders", "/local-privacy"]);

type VitalEntry = PerformanceEntry & { value?: number; duration?: number; interactionId?: number; hadRecentInput?: boolean; startTime: number };

export default function PerformanceReporter() {
  useEffect(() => {
    const path = window.location.pathname;
    if (!sampledPaths.has(path) || Math.random() >= 0.1) return;

    let lcpMs: number | null = null;
    let inpMs: number | null = null;
    let clsScore = 0;
    let reported = false;
    const observers: PerformanceObserver[] = [];
    const observe = (type: string, callback: (entries: VitalEntry[]) => void) => {
      if (!("PerformanceObserver" in window)) return;
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries() as VitalEntry[]));
        observer.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(observer);
      } catch { /* Unsupported browser metric. */ }
    };
    observe("largest-contentful-paint", (entries) => { const latest = entries.at(-1); if (latest) lcpMs = Math.round(latest.startTime); });
    observe("layout-shift", (entries) => { for (const entry of entries) if (!entry.hadRecentInput) clsScore += entry.value || 0; });
    observe("event", (entries) => { for (const entry of entries) if (entry.interactionId) inpMs = Math.max(inpMs || 0, Math.round(entry.duration || 0)); });

    const report = () => {
      if (reported) return;
      reported = true;
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!navigation) return;
      const ttfbMs = Math.round(navigation.responseStart - navigation.requestStart);
      if (navigation.loadEventEnd <= 0) return;
      const loadMs = Math.round(navigation.loadEventEnd - navigation.startTime);
      if (ttfbMs < 0 || loadMs < 0 || loadMs > 120_000) return;

      const payload = JSON.stringify({ path, ttfbMs, loadMs, lcpMs, inpMs, clsMilli: Math.round(clsScore * 1000) });
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

    const onPageHide = () => report();
    window.addEventListener("pagehide", onPageHide, { once: true });
    window.addEventListener("load", report, { once: true });
    return () => { window.removeEventListener("pagehide", onPageHide); window.removeEventListener("load", report); observers.forEach((observer) => observer.disconnect()); };
  }, []);

  return null;
}
