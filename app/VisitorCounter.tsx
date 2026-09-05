"use client";

import { useEffect, useState } from "react";

export default function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/visitor/event", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { visitors?: number };
        if (active && Number.isFinite(data.visitors)) setCount(Math.max(0, Math.floor(data.visitors || 0)));
      } catch {}
    };
    void load();
    return () => { active = false; };
  }, []);

  return <div className="navixa-visitor-counter" role="status" aria-live="polite">
    <span>الزوار</span>
    <strong>{count === null ? "…" : count.toLocaleString("ar-SA")}</strong>
  </div>;
}
