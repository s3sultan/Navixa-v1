"use client";

import { useEffect } from "react";

type TelegramLinkResponse = { link?: string; error?: string };

function validTelegramLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "t.me" && /^\/[A-Za-z0-9_]{5,}\/?$/.test(url.pathname) && Boolean(url.searchParams.get("start"));
  } catch {
    return false;
  }
}

export default function TelegramOneClickLink() {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button.account-secondary");
      if (!(button instanceof HTMLButtonElement) || button.textContent?.trim() !== "ربط Telegram") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const previousText = button.textContent || "ربط Telegram";
      button.disabled = true;
      button.textContent = "جارٍ فتح Telegram…";

      try {
        const response = await fetch("/api/account/telegram/link", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({})) as TelegramLinkResponse;
        if (!response.ok) throw new Error(data.error || "تعذر بدء ربط Telegram");
        if (!validTelegramLink(data.link)) throw new Error("رابط Telegram غير صالح");

        // Top-level navigation is intentionally used instead of window.open.
        // Safari/iOS may block a popup created after an awaited fetch, while
        // assigning the current tab remains a reliable one-click handoff to Telegram.
        window.location.assign(data.link);
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
