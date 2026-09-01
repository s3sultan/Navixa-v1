"use client";

import { useEffect } from "react";

type TelegramLinkResponse = { link?: string; error?: string };

function parseTelegramLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const token = url.searchParams.get("start") || "";
    const bot = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (url.protocol !== "https:" || url.hostname !== "t.me" || !/^[A-Za-z0-9_]{5,}$/.test(bot) || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
    return { link: url.toString(), token, bot };
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

        const fallbackCommand = `/activate ${telegram.token}`;
        try { await navigator.clipboard?.writeText(fallbackCommand); } catch {}
        try { sessionStorage.setItem("navixa-telegram-link-command", fallbackCommand); } catch {}

        button.textContent = "Telegram جاهز للتأكيد";

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          const appLink = `tg://resolve?domain=${encodeURIComponent(telegram.bot)}&start=${encodeURIComponent(telegram.token)}`;
          window.location.href = appLink;
          window.setTimeout(() => window.location.assign(telegram.link), 900);
          return;
        }

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
