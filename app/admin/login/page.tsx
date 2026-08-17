"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./login.css";
import { GOOGLE_CLIENT_ID, saveAdminToken, verifyGoogleAdminToken } from "../localAuth";

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
  const [state, setState] = useState<LoginState>("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const finishGoogleLogin = useCallback(async (credential: string) => {
    setState("authorizing");
    setError("");

    const verified = await verifyGoogleAdminToken(credential);
    if (!verified.ok) {
      setError(verified.error);
      setState("ready");
      return;
    }

    saveAdminToken(credential);
    window.location.assign("/admin");
  }, []);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;
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

    const stopWaiting = () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };

    const ready = () => {
      if (mountGoogleButton()) {
        stopWaiting();
        return true;
      }
      return false;
    };

    setState("loading");
    setError("");
    if (ready()) return () => { active = false; stopWaiting(); };

    const selector = "script[data-navixa-google='true']";
    let script = document.querySelector<HTMLScriptElement>(selector);
    const onLoad = () => { ready(); };
    const onError = () => {
      if (!active) return;
      stopWaiting();
      setError("تعذر تحميل Google من الشبكة. جرّب إعادة التجهيز أو أوقف مانع المحتوى لهذه الصفحة.");
      setState("error");
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.navixaGoogle = "true";
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    }

    interval = setInterval(ready, 250);
    timeout = setTimeout(() => {
      if (!active || ready()) return;
      stopWaiting();
      setError("لم يجهز زر Google خلال 12 ثانية. اضغط إعادة تجهيز الدخول، وتأكد من عدم حظر Google أو JavaScript في المتصفح.");
      setState("error");
    }, 12000);

    return () => {
      active = false;
      stopWaiting();
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [finishGoogleLogin, reloadKey]);

  const statusText = state === "loading"
    ? "جارٍ تجهيز تسجيل الدخول الآمن…"
    : state === "authorizing"
      ? "جارٍ التحقق من الحساب وفتح لوحة الإدارة…"
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
        {state === "error" && <button className="google-retry" onClick={() => setReloadKey(key => key + 1)}>إعادة تجهيز الدخول</button>}
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
