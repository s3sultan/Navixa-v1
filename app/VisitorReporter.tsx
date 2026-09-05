"use client";

import { useEffect } from "react";

const ignored = ["/admin", "/api"];

export default function VisitorReporter() {
  useEffect(() => {
    if (ignored.some(prefix => window.location.pathname.startsWith(prefix))) return;
    const report = () => {
      const path = window.location.pathname || "/";
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const key = `navixa-visit-${day}-${path}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      void fetch("/api/visitor/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }), keepalive: true }).catch(() => undefined);
    };
    report();
  }, []);
  return null;
}
