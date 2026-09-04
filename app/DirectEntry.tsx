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
      localStorage.setItem("navixa-hide-welcome", "1");
      localStorage.setItem("navixa-welcome-hidden", "1");
      localStorage.setItem("navixa-entered", "1");
      sessionStorage.setItem("navixa-entered", "1");
    } catch {}

    document.documentElement.dataset.navixaDirectEntry = "true";

    const isMobile = () => window.matchMedia("(max-width: 650px)").matches;

    const mountMobileAdminEntry = () => {
      if (!isMobile()) return;
      const footer = document.querySelector<HTMLElement>(".nx-public-footer-shell");
      if (!footer || footer.querySelector(".mobile-admin-footer-entry")) return;
      const link = document.createElement("a");
      link.className = "mobile-admin-footer-entry";
      link.href = "/admin/login";
      link.textContent = "دخول الإدارة";
      link.setAttribute("aria-label", "دخول لوحة إدارة NAVIXA");
      footer.appendChild(link);
    };

    const guardMobileScreenSharing = () => {
      if (!isMobile()) return;
      const modals = document.querySelectorAll<HTMLElement>(".assistant-tool-modal");
      modals.forEach((modal) => {
        if (!modal.textContent?.includes("متابعة الشاشة")) return;
        const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>("button"));
        const shareButton = buttons.find((button) => /اختيار شاشة|إيقاف المشاركة/.test(button.textContent || ""));
        if (shareButton) shareButton.style.display = "none";
        if (!modal.querySelector(".mobile-screen-unavailable")) {
          const notice = document.createElement("p");
          notice.className = "mobile-screen-unavailable";
          notice.textContent = "متابعة الشاشة متاحة على الكمبيوتر حاليًا";
          modal.appendChild(notice);
        }
      });
    };

    const syncMobileUi = () => {
      mountMobileAdminEntry();
      guardMobileScreenSharing();
    };

    syncMobileUi();
    const observer = new MutationObserver(syncMobileUi);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelector(".mobile-admin-footer-entry")?.remove();
      document.querySelectorAll(".mobile-screen-unavailable").forEach((item) => item.remove());
      delete document.documentElement.dataset.navixaDirectEntry;
    };
  }, []);

  return null;
}
