"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Subscription = { plan: string; status: string; trial_ends_at: string; subscription_ends_at: string };
type Session = { enabled: boolean; signedIn: boolean; trialDays?: number; googleLoginEnabled?: boolean; passkeysEnabled?: boolean; earlyAccessEnabled?: boolean; user?: { email: string } | null; plus?: Subscription | null };
type TelegramLink = { enabled: boolean; linked: boolean; linkedAt?: string | null };
type GoogleIdentity = { accounts: { id: { initialize: (options: { client_id: string; callback: (result: { credential: string }) => void; itp_support?: boolean; auto_select?: boolean; cancel_on_tap_outside?: boolean }) => void; renderButton: (element: HTMLElement, options: Record<string, string | number>) => void; prompt?: () => void } } };
const headers = { "Content-Type": "application/json" };
const REMEMBERED_EMAIL_KEY = "navixa-last-login-email";
const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
let googleIdentityInitialized = false;
let googleCredentialHandler: ((credential: string) => void) | null = null;

export default function AccountAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [rememberedEmail, setRememberedEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [googleState, setGoogleState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [telegram, setTelegram] = useState<TelegramLink | null>(null);
  const [renewalTelegram, setRenewalTelegram] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);
  const load = async () => { const response = await fetch("/api/account/session", { cache: "no-store" }); const data = await response.json().catch(() => ({ enabled: false, signedIn: false })); setSession(data); };
  const loadTelegram = async () => { const response = await fetch("/api/account/telegram/link", { cache: "no-store" }); const data = await response.json().catch(() => ({ enabled: false, linked: false })); const state = response.ok ? data as TelegramLink : { enabled: false, linked: false }; setTelegram(state); if (state.linked) { const preference = await fetch("/api/account/telegram/preferences", { cache: "no-store" }).then(value => value.json()).catch(() => ({ enabled: false })); setRenewalTelegram(Boolean(preference.enabled)); } else setRenewalTelegram(false); };
  useEffect(() => { const saved = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)?.trim().toLowerCase() || ""; if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved)) { setEmail(saved); setRememberedEmail(saved); } void load(); void loadTelegram(); }, []);
  const requestCode = async () => { setBusy(true); setNotice(""); const response = await fetch("/api/account/code/request", { method: "POST", headers, body: JSON.stringify({ email }) }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { setNotice(data.error || "تعذر طلب الرمز الآن"); return; } setSent(true); setNotice(data.message || "أرسلنا رمز الدخول إذا كان البريد صالحًا."); };
  const openWorkspace = () => {
    const candidate = new URLSearchParams(window.location.search).get("next") || "/";
    const safeNext = candidate.startsWith("/api/portfolio/authorize?") ? candidate : "/";
    window.location.replace(safeNext);
  };
  const finishGoogleLogin = useCallback(async (credential: string) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/account/google", { method: "POST", headers, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ credential }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "تعذر تأكيد دخول Google");
      if (data.user?.email) { setEmail(data.user.email); window.localStorage.setItem(REMEMBERED_EMAIL_KEY, data.user.email); setRememberedEmail(data.user.email); }
      setNotice("تم الدخول بحساب Google الموثق. جارٍ فتح أدواتك…");
      window.setTimeout(openWorkspace, 180);
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تأكيد دخول Google"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (!session?.enabled || session.signedIn || !session.googleLoginEnabled) return;
    googleCredentialHandler = finishGoogleLogin;
    let active = true, timeout: ReturnType<typeof setTimeout> | undefined;
    const mount = () => {
      const google = (window as Window & { google?: GoogleIdentity }).google, target = googleButton.current;
      if (!active || !google?.accounts?.id || !target) return false;
      target.replaceChildren();
      if (!googleIdentityInitialized) {
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => googleCredentialHandler?.(credential), itp_support: true, auto_select: false, cancel_on_tap_outside: true });
        googleIdentityInitialized = true;
      }
      google.accounts.id.renderButton(target, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left", width: Math.max(240, Math.min(360, Math.floor(target.getBoundingClientRect().width || 360))), locale: "ar" });
      setGoogleState("ready"); return true;
    };
    if (mount()) return () => { active = false; };
    setGoogleState("loading");
    const selector = "script[data-navixa-google='true']";
    let script = document.querySelector<HTMLScriptElement>(selector);
    const loaded = () => { if (!mount() && active) setGoogleState("error"); };
    const failed = () => { if (active) setGoogleState("error"); };
    if (!script) { script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.dataset.navixaGoogle = "true"; script.addEventListener("load", loaded, { once: true }); script.addEventListener("error", failed, { once: true }); document.head.appendChild(script); }
    else script.addEventListener("load", loaded, { once: true });
    timeout = setTimeout(() => { if (active && !mount()) setGoogleState("error"); }, 12000);
    return () => { active = false; if (googleCredentialHandler === finishGoogleLogin) googleCredentialHandler = null; if (timeout) clearTimeout(timeout); script?.removeEventListener("load", loaded); script?.removeEventListener("error", failed); };
  }, [finishGoogleLogin, session?.enabled, session?.googleLoginEnabled, session?.signedIn]);
  const rememberVerifiedEmail = () => { const value = email.trim().toLowerCase(); if (!value) return; window.localStorage.setItem(REMEMBERED_EMAIL_KEY, value); setRememberedEmail(value); };
  const forgetRememberedEmail = () => { window.localStorage.removeItem(REMEMBERED_EMAIL_KEY); setRememberedEmail(""); setEmail(""); setSent(false); setCode(""); setNotice("تم نسيان البريد من هذا الجهاز."); };
  const verify = async () => { setBusy(true); setNotice(""); const response = await fetch("/api/account/code/verify", { method: "POST", headers, body: JSON.stringify({ email, code }) }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { setNotice(data.error || "تعذر التحقق من الرمز"); return; } rememberVerifiedEmail(); setNotice("تم الدخول بأمان. جارٍ فتح أدواتك…"); window.setTimeout(openWorkspace, 180); };
  const logout = async () => { setBusy(true); await fetch("/api/account/logout", { method: "POST" }); window.localStorage.removeItem(REMEMBERED_EMAIL_KEY); setRememberedEmail(""); setEmail(""); setBusy(false); setSent(false); setCode(""); setTelegram(null); await load(); };
  const linkTelegram = async () => { setBusy(true); setNotice(""); try { const response = await fetch("/api/account/telegram/link", { method: "POST" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "تعذر بدء ربط Telegram"); window.open(data.link, "_blank", "noopener,noreferrer"); setNotice("افتح بوت NAVIXA واضغط Start لإكمال الربط، ثم عد إلى هذه الصفحة."); } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر بدء ربط Telegram"); } finally { setBusy(false); } };
  const unlinkTelegram = async () => { setBusy(true); setNotice(""); const response = await fetch("/api/account/telegram/link", { method: "DELETE" }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { setNotice(data.error || "تعذر فصل Telegram"); return; } setNotice("تم فصل Telegram من حسابك."); await loadTelegram(); };
  const setRenewalReminder = async (enabled: boolean) => { setBusy(true); setNotice(""); const response = await fetch("/api/account/telegram/preferences", { method: "POST", headers, body: JSON.stringify({ type: "renewal", enabled }) }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { setNotice(data.error || "تعذر تحديث تذكير التجديد"); return; } setRenewalTelegram(enabled); setNotice(enabled ? "تم تفعيل تذكير التجديد عبر Telegram." : "تم إيقاف تذكير التجديد عبر Telegram."); };
  const enablePasskey = async () => { setBusy(true); setNotice(""); try { const optionsResponse = await fetch("/api/account/passkeys/register/options", { method: "POST" }); const optionsData = await optionsResponse.json().catch(() => ({})); if (!optionsResponse.ok) throw new Error(optionsData.error || "تعذر بدء Passkey"); const { startRegistration } = await import("@simplewebauthn/browser"); const response = await startRegistration({ optionsJSON: optionsData.options }); const verifyResponse = await fetch("/api/account/passkeys/register/verify", { method: "POST", headers, body: JSON.stringify(response) }); const verifyData = await verifyResponse.json().catch(() => ({})); if (!verifyResponse.ok) throw new Error(verifyData.error || "تعذر تفعيل Passkey"); setNotice(verifyData.message || "تم تفعيل الدخول السريع."); } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تفعيل Passkey"); } finally { setBusy(false); } };
  const loginWithPasskey = async () => { setBusy(true); setNotice(""); try { const optionsResponse = await fetch("/api/account/passkeys/auth/options", { method: "POST", headers, body: JSON.stringify({ email }) }); const optionsData = await optionsResponse.json().catch(() => ({})); if (!optionsResponse.ok) throw new Error(optionsData.error || "تعذر بدء الدخول السريع"); const { startAuthentication } = await import("@simplewebauthn/browser"); const response = await startAuthentication({ optionsJSON: optionsData.options }); const verifyResponse = await fetch("/api/account/passkeys/auth/verify", { method: "POST", headers, body: JSON.stringify({ email, response }) }); const verifyData = await verifyResponse.json().catch(() => ({})); if (!verifyResponse.ok) throw new Error(verifyData.error || "تعذر الدخول السريع"); rememberVerifiedEmail(); setNotice("تم الدخول بأمان. جارٍ فتح أدواتك…"); window.setTimeout(openWorkspace, 180); } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر الدخول السريع"); } finally { setBusy(false); } };
  if (!session) return <section className="account-card" aria-busy="true"><p>جارٍ تجهيز الدخول الآمن…</p></section>;
  const isRememberedEmail = Boolean(rememberedEmail && email === rememberedEmail);
  if (!session.enabled) return <section className="account-card account-closed"><span>التجربة المبكرة</span><h2>قريبًا</h2><p>حسابات NAVIXA Plus ستفتح تدريجيًا بعد تهيئة بريد الدخول الآمن. ميزاتك المحلية لا تحتاج حسابًا ولا تتأثر بهذا الانتظار.</p><a href="/plus">سجّل اهتمامك في Plus</a></section>;
  if (session.signedIn && session.user) { const plusEnd = session.plus?.status === "trial" ? session.plus.trial_ends_at : session.plus?.subscription_ends_at; const plusText = session.plus?.status === "trial" ? "تجربة Plus نشطة" : session.plus?.status === "active" ? "اشتراك Plus نشط" : session.earlyAccessEnabled ? "ستظهر تجربة Plus هنا بعد التحقق" : "سيظهر اشتراكك هنا عند تفعيله"; return <section className="account-card account-signed"><span>تم الدخول</span><h2>مرحبًا بك في NAVIXA</h2><p>{session.user.email}</p><div className="account-status"><b>{plusText}</b><small>{plusEnd ? `تنتهي في ${new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(plusEnd))}` : session.passkeysEnabled ? "فعّل الدخول السريع ببصمة الجهاز أو Face ID. سيبقى رمز البريد متاحًا لاسترداد الوصول." : "يمكنك متابعة حسابك من هذا الجهاز بأمان."}</small></div>{session.passkeysEnabled && <button className="account-passkey" disabled={busy} onClick={() => void enablePasskey()}>{busy ? "جارٍ التفعيل…" : "فعّل الدخول السريع لهذا الجهاز"}</button>}{telegram?.enabled && <div className="account-telegram"><b>تنبيهات Telegram</b><small>{telegram.linked ? "البوت مرتبط بحسابك. تصلك فقط التنبيهات التي تختارها." : "اربط بوت NAVIXA مرة واحدة؛ لا نطلب منك Bot Token أو Chat ID."}</small><button className="account-secondary" disabled={busy} onClick={() => void (telegram.linked ? unlinkTelegram() : linkTelegram())}>{busy ? "جارٍ التنفيذ…" : telegram.linked ? "فصل Telegram" : "ربط Telegram"}</button>{telegram.linked && <button className="account-secondary" disabled={busy} onClick={() => void setRenewalReminder(!renewalTelegram)}>{renewalTelegram ? "إيقاف تذكير التجديد" : "فعّل تذكير التجديد"}</button>}</div>}<button disabled={busy} onClick={() => void logout()}>{busy ? "جارٍ الخروج…" : "تسجيل الخروج"}</button>{notice && <p className="account-notice" role="status">{notice}</p>}</section>; }
  return <section className="account-card"><span>حساب NAVIXA</span><h2>{sent ? "أدخل الرمز" : isRememberedEmail ? "مرحبًا بعودتك" : "ادخل ببريدك"}</h2><p>{sent ? "أرسلنا رمزًا من ستة أرقام، صالحًا لمدة 10 دقائق ويُستخدم مرة واحدة فقط." : isRememberedEmail ? "بريدك ظاهر على هذا الجهاز. إذا انتهت الجلسة، أرسل رمز دخول جديدًا فقط." : "لا تحتاج إلى كلمة مرور. يمكنك استخدام بريدك أو حساب Google الموثق."}</p>{!sent ? <>{session.googleLoginEnabled && <div className="account-google"><div ref={googleButton} aria-label="الدخول بحساب Google" /><small>{googleState === "loading" ? "جارٍ تجهيز زر Google…" : googleState === "error" ? "تعذر تجهيز Google الآن؛ استخدم رمز البريد مؤقتًا." : "لا نرى كلمة مرور Google ولا نحفظها."}</small></div>}<div className="account-divider" aria-hidden="true">أو</div><label>البريد الإلكتروني<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={160}/></label>{isRememberedEmail && <button type="button" className="account-link" disabled={busy} onClick={forgetRememberedEmail}>ليس بريدي أو استخدم بريدًا آخر</button>}<button disabled={busy || !email.includes("@") } onClick={() => void requestCode()}>{busy ? "جارٍ الإرسال…" : isRememberedEmail ? "أرسل رمز الدخول إلى بريدي" : "أرسل رمز الدخول"}</button>{session.passkeysEnabled && <button className="account-secondary" disabled={busy || !email.includes("@") } onClick={() => void loginWithPasskey()}>الدخول السريع ببصمة الجهاز</button>}</> : <><label>رمز الدخول<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6}/></label><button disabled={busy || code.length !== 6} onClick={() => void verify()}>{busy ? "جارٍ التحقق…" : "تأكيد الدخول"}</button><button className="account-link" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>تغيير البريد</button></>}{notice && <p className="account-notice" role="status">{notice}</p>}</section>;
}
