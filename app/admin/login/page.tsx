"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./login.css";

const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (result: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
};

type LoginState = "loading" | "ready" | "authorizing" | "error";

export default function AdminLogin() {
  const googleButton = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState<LoginState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const finishGoogleLogin = useCallback(async (credential: string) => {
    setState("authorizing");
    setError("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ credential }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "تعذر تسجيل الدخول بهذا الحساب");
        setState("ready");
        return;
      }
      if (!data.sessionId || typeof data.sessionId !== "string") {
        setError("تم التحقق من الحساب، لكن الخادم لم ينشئ جلسة إدارة.");
        setState("ready");
        return;
      }

      sessionStorage.setItem("navixa_admin_session", data.sessionId);
      const session = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        headers: { "x-navixa-admin-session": data.sessionId },
      });
      if (!session.ok) {
        const details = await session.json().catch(() => ({}));
        sessionStorage.removeItem("navixa_admin_session");
        setError(details.error || "لم يقبل الخادم جلسة الإدارة الجديدة.");
        setState("ready");
        return;
      }

      window.location.assign("/admin");
    } catch {
      setError("تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الشبكة ثم أعد المحاولة.");
      setState("ready");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const mountGoogleButton = () => {
      const google = (window as Window & { google?: GoogleIdentity }).google;
      const mount = googleButton.current;
      if (!active || !google?.accounts?.id || !mount) return false;

      try {
        mount.replaceChildren();
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => void finishGoogleLogin(credential),
        });
        google.accounts.id.renderButton(mount, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 360,
          locale: "ar",
        });
        setState("ready");
        return true;
      } catch {
        setError("تعذر تجهيز زر Google. أعد المحاولة.");
        setState("error");
        return true;
      }
    };

    if (mountGoogleButton()) return () => { active = false; };

    const existing = document.querySelector<HTMLScriptElement>('script[data-navixa-google="true"]');
    const script = existing || document.createElement("script");
    const onLoad = () => { if (!mountGoogleButton() && active) { setError("تم تحميل Google لكن لم يجهز زر الدخول."); setState("error"); } };
    const onError = () => { if (active) { setError("تعذر تحميل Google. تحقق من الشبكة ثم أعد المحاولة."); setState("error"); } };

    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.navixaGoogle = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    timeout = setTimeout(() => {
      if (active && !(window as Window & { google?: GoogleIdentity }).google?.accounts?.id) {
        setError("استغرق تحميل Google وقتًا أطول من المتوقع. اضغط إعادة تجهيز الدخول.");
        setState("error");
      }
    }, 10000);

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [finishGoogleLogin, reloadKey]);

  const statusText = state === "loading"
    ? "جارٍ تجهيز تسجيل الدخول الآمن…"
    : state === "authorizing"
      ? "جارٍ التحقق من الحساب وفتح الجلسة…"
      : "";

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <Link href="/" className="login-brand">
          <span className="login-logo-mark"><img src="/navixa-mark.png" alt="" /></span>
          <div><b>NAVIXA</b><small>ADMIN CENTER</small></div>
        </Link>
        <div className="login-title">
          <small>دخول الإدارة الآمن</small>
          <h1>مرحبًا بعودتك</h1>
          <p>اختر حساب Google المصرّح له للوصول إلى لوحة الإدارة.</p>
        </div>
        <div className="google-login-box shown" aria-busy={state === "loading" || state === "authorizing"}>
          <div ref={googleButton} />
          {statusText && <span className="google-status">{statusText}</span>}
        </div>
        {state === "error" && <button className="google-retry" onClick={() => { setError(""); setState("loading"); setReloadKey((key) => key + 1); }}>إعادة تجهيز الدخول</button>}
        {error && <p className="login-error" role="alert">{error}</p>}
        <p className="privacy">🔒 NAVIXA لا يرى كلمة مرور Google ولا يحفظها.</p>
      </section>
      <aside>
        <div className="admin-aside-mark"><img src="/navixa-mark.png" alt="شعار NAVIXA" /></div>
        <h2>إدارة NAVIXA<br />بوضوح وثقة.</h2>
        <p>دخول مباشر وآمن باستخدام الحساب المصرّح فقط.</p>
        <small>حماية واضحة · صلاحيات محددة · خصوصية أولًا</small>
      </aside>
    </main>
  );
}
