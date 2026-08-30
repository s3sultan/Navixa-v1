"use client";

import { useEffect } from "react";

type TelegramLinkResponse = { link?: string; error?: string };

function parseTelegramLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const token = url.searchParams.get("start") || "";
    if (url.protocol !== "https:" || url.hostname !== "t.me" || !/^\/[A-Za-z0-9_]{5,}\/?$/.test(url.pathname) || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
    return { link: url.toString(), token };
  } catch {
    return null;
  }
}

export default function TelegramOneClickLink() {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(".account-telegram button.account-secondary");
      if (!(button instanceof HTMLButtonElement) || !button.textContent?.includes("ربط Telegram")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const previousText = button.textContent || "ربط Telegram";
      button.disabled = true;
      button.textContent = "جارٍ تجهيز الربط…";

      try {
        const response = await fetch("/api/account/telegram/link", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({})) as TelegramLinkResponse;
        if (!response.ok) throw new Error(data.error || "تعذر بدء ربط Telegram");
        const telegram = parseTelegramLink(data.link);
        if (!telegram) throw new Error("رابط Telegram غير صالح");

        // Telegram Web/Desktop may sometimes open an already-started chat without
        // surfacing the deep-link START action. Keep a short-lived fallback command
        // on the clipboard so the same secure token can still complete the link.
        try { await navigator.clipboard?.writeText(`/start ${telegram.token}`); } catch {}
        button.textContent = "افتح Telegram واضغط START";
        window.location.assign(telegram.link);
      } catch (error) {
        button.disabled = false;
        button.textContent = previousText;
        window.alert(error instanceof Error ? error.message : "تعذر بدء ربط Telegram");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
