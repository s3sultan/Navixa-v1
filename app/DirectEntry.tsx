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

  return <style>{`
    .welcome,
    html[data-navixa-direct-entry="true"] .welcome-screen,
    html[data-navixa-direct-entry="true"] .welcome-overlay,
    html[data-navixa-direct-entry="true"] .welcome-gate,
    html[data-navixa-direct-entry="true"] .entry-gate,
    html[data-navixa-direct-entry="true"] .auth-gate { display:none !important; }

    .mobile-admin-footer-entry,
    .mobile-screen-unavailable { display:none; }

    @media (max-width:650px) {
      .mobile-admin-footer-entry {
        width:max-content;
        margin:18px auto 4px;
        padding:8px 12px;
        display:block;
        color:#718079;
        border:1px solid #e1e7e4;
        border-radius:10px;
        background:rgba(255,255,255,.72);
        text-decoration:none;
        font-size:11px;
        font-weight:600;
      }

      .mobile-screen-unavailable {
        display:block;
        margin:14px 0 0;
        padding:12px 14px;
        border:1px solid #e1e7e4;
        border-radius:12px;
        background:rgba(255,255,255,.72);
        color:#60706a;
        text-align:center;
        font-size:13px;
        font-weight:700;
      }
    }
  `}</style>;
}
