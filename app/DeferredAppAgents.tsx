"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VisitorReporter = dynamic(() => import("./VisitorReporter"), { ssr: false });
const PrayerAlertSync = dynamic(() => import("./PrayerAlertSync"), { ssr: false });
const PushSubscriptionBootstrap = dynamic(() => import("./PushSubscriptionBootstrap"), { ssr: false });
const ClassScheduleShortcut = dynamic(() => import("./ClassScheduleShortcut"), { ssr: false });
const DeviceControlAgent = dynamic(() => import("./DeviceControlAgent"), { ssr: false });

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function DeferredAppAgents() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    const activate = () => { if (!stopped) setReady(true); };
    const idle = window as IdleWindow;

    if (idle.requestIdleCallback) {
      const id = idle.requestIdleCallback(activate, { timeout: 1200 });
      return () => { stopped = true; idle.cancelIdleCallback?.(id); };
    }

    const timer = window.setTimeout(activate, 300);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);

  if (!ready) return null;
  return <>
    <VisitorReporter />
    <PrayerAlertSync />
    <PushSubscriptionBootstrap />
    <ClassScheduleShortcut />
    <DeviceControlAgent />
  </>;
}
