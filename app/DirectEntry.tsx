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
      localStorage.setItem("navixa-welcome-hidden", "1");
      localStorage.setItem("navixa-entered", "1");
      sessionStorage.setItem("navixa-entered", "1");
    } catch {}

    document.documentElement.dataset.navixaDirectEntry = "true";

    const mountMobileAdminEntry = () => {
      if (!window.matchMedia("(max-width: 650px)").matches) return;
      const footer = document.querySelector<HTMLElement>(".nx-public-footer-shell");
      if (!footer || footer.querySelector(".mobile-admin-footer-entry")) return;
      const link = document.createElement("a");
      link.className = "mobile-admin-footer-entry";
      link.href = "/admin/login";
      link.textContent = "دخول الإدارة";
      link.setAttribute("aria-label", "دخول لوحة إدارة NAVIXA");
      footer.appendChild(link);
    };

    mountMobileAdminEntry();
    const observer = new MutationObserver(mountMobileAdminEntry);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelector(".mobile-admin-footer-entry")?.remove();
      delete document.documentElement.dataset.navixaDirectEntry;
    };
  }, []);

  return <style>{`
    html[data-navixa-direct-entry="true"] .welcome-screen,
    html[data-navixa-direct-entry="true"] .welcome-overlay,
    html[data-navixa-direct-entry="true"] .welcome-gate,
    html[data-navixa-direct-entry="true"] .entry-gate,
    html[data-navixa-direct-entry="true"] .auth-gate { display:none !important; }

    .mobile-admin-footer-entry { display:none; }
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
    }
  `}</style>;
}
