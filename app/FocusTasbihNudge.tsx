"use client";

import { useEffect, useRef, useState } from "react";

const phrases = [
  "أستغفر الله",
  "سبحان الله وبحمده",
  "لا إله إلا الله",
  "اللهم صلِّ وسلم على نبينا محمد",
  "الحمد لله",
];

export default function FocusTasbihNudge({ running, elapsedSeconds }: { running: boolean; elapsedSeconds: number }) {
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const lastCheckpoint = useRef<number | null>(null);

  useEffect(() => {
    setEnabled(localStorage.getItem("navixa-focus-dhikr") !== "off");
  }, []);

  useEffect(() => {
    if (!running || !enabled) {
      setVisible(false);
      lastCheckpoint.current = null;
      return;
    }

    // The first reminder comes after 90 seconds, then a single gentle reminder every five minutes.
    if (elapsedSeconds < 90) return;
    const checkpoint = Math.floor(elapsedSeconds / 300);
    if (lastCheckpoint.current === checkpoint) return;

    lastCheckpoint.current = checkpoint;
    setIndex(checkpoint % phrases.length);
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 13000);
    return () => window.clearTimeout(timeout);
  }, [running, enabled, elapsedSeconds]);

  const toggle = () => {
    setEnabled(current => {
      const next = !current;
      localStorage.setItem("navixa-focus-dhikr", next ? "on" : "off");
      if (!next) setVisible(false);
      return next;
    });
  };

  return (
    <div className={`focus-dhikr ${visible ? "is-visible" : ""}`}>
      {visible && <p aria-live="polite"><span>✦</span>{phrases[index]}</p>}
      <button type="button" onClick={toggle} aria-pressed={enabled}>
        {enabled ? "ذكر هادئ: مفعّل" : "ذكر هادئ: متوقف"}
      </button>
    </div>
  );
}
