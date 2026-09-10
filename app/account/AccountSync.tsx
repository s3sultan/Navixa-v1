"use client";

import { useEffect, useState } from "react";

type SessionResponse = { signedIn?: boolean };
type SyncResponse = {
  ok?: boolean;
  found?: boolean;
  payload?: string | null;
  version?: number;
  updatedAt?: string | null;
  conflict?: boolean;
  currentVersion?: number;
  error?: string;
};

const backupKeys = () => Object.keys(localStorage).filter(key => key.startsWith("navixa-") || key.startsWith("navixa_"));

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function deriveSyncKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptSyncPayload(value: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSyncKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return JSON.stringify({ v: 1, alg: "AES-GCM", salt: bytesToBase64(salt), iv: bytesToBase64(iv), cipher: bytesToBase64(new Uint8Array(cipher)) });
}

async function decryptSyncPayload(envelope: string, passphrase: string) {
  const box = JSON.parse(envelope) as { v?: number; alg?: string; salt?: string; iv?: string; cipher?: string };
  if (box.v !== 1 || box.alg !== "AES-GCM" || !box.salt || !box.iv || !box.cipher) throw new Error("invalid-envelope");
  const key = await deriveSyncKey(passphrase, base64ToBytes(box.salt));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(box.iv) }, key, base64ToBytes(box.cipher));
  return new TextDecoder().decode(plain);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "لا توجد نسخة سحابية لهذا الحساب حتى الآن";
  try {
    return `آخر تحديث: ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}`;
  } catch {
    return "توجد نسخة سحابية لهذا الحساب";
  }
}

export default function AccountSync() {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(false);
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const refreshCloudState = async () => {
    const response = await fetch("/api/sync", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({})) as SyncResponse;
    setFound(Boolean(data.found));
    setVersion(Number.isInteger(data.version) ? Number(data.version) : 0);
    setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/account/session", { cache: "no-store", credentials: "same-origin" });
        const session = await response.json().catch(() => ({})) as SessionResponse;
        if (!active) return;
        const authenticated = response.ok && Boolean(session.signedIn);
        setSignedIn(authenticated);
        if (authenticated) await refreshCloudState();
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const validatePassphrase = () => {
    if (passphrase.length >= 8) return true;
    setNotice("اكتب كلمة تشفير من 8 أحرف على الأقل. لا تُحفظ ولا تُرسل إلى NAVIXA.");
    return false;
  };

  const upload = async () => {
    if (!validatePassphrase()) return;
    setBusy(true);
    setNotice("جارٍ تشفير بيانات هذا الجهاز محليًا…");
    try {
      const plain = JSON.stringify({
        format: "NAVIXA_LOCAL_BACKUP",
        version: 1,
        createdAt: new Date().toISOString(),
        data: Object.fromEntries(backupKeys().map(key => [key, localStorage.getItem(key)])),
      });
      if (plain.length > 640_000) throw new Error("too-large");
      const payload = await encryptSyncPayload(plain, passphrase);
      const body: Record<string, unknown> = { payload };
      if (version > 0) body.expectedVersion = version;
      const response = await fetch("/api/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as SyncResponse;
      if (response.status === 409 || data.conflict) {
        setVersion(Number(data.currentVersion) || version);
        setNotice("يوجد تحديث أحدث من جهاز آخر. استعد النسخة أولًا ثم قرر ما تريد رفعه.");
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "upload-failed");
      setFound(true);
      setVersion(Number(data.version) || Math.max(1, version + 1));
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString());
      setNotice("تم رفع نسخة مشفرة مرتبطة بحسابك. كلمة التشفير بقيت على هذا الجهاز فقط.");
    } catch (error) {
      setNotice(error instanceof Error && error.message === "too-large" ? "حجم البيانات المحلية أكبر من حد المزامنة الحالي. استخدم التصدير المحلي مؤقتًا." : "تعذر رفع النسخة الآن. بيانات جهازك لم تتغير.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!validatePassphrase()) return;
    setBusy(true);
    setNotice("جارٍ جلب النسخة المشفرة وفكها على هذا الجهاز…");
    try {
      const response = await fetch("/api/sync", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({})) as SyncResponse;
      if (!response.ok || !data.found || typeof data.payload !== "string") throw new Error("not-found");
      const plain = await decryptSyncPayload(data.payload, passphrase);
      const backup = JSON.parse(plain) as { format?: string; data?: Record<string, unknown> };
      if (backup.format !== "NAVIXA_LOCAL_BACKUP" || !backup.data || typeof backup.data !== "object") throw new Error("invalid-backup");
      for (const [key, value] of Object.entries(backup.data)) {
        if (key.startsWith("navixa-") || key.startsWith("navixa_")) localStorage.setItem(key, String(value ?? ""));
      }
      setVersion(Number(data.version) || version);
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : updatedAt);
      setNotice("تمت الاستعادة بنجاح. سيُعاد تحميل NAVIXA لتطبيق بياناتك.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setNotice("تعذر الاستعادة. تأكد من كلمة التشفير وأن لهذا الحساب نسخة سحابية.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("حذف النسخة السحابية المشفرة لهذا الحساب؟ بيانات هذا الجهاز لن تُحذف.")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/sync", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("delete-failed");
      setFound(false);
      setVersion(0);
      setUpdatedAt(null);
      setNotice("تم حذف النسخة السحابية. بيانات هذا الجهاز بقيت كما هي.");
    } catch {
      setNotice("تعذر حذف النسخة السحابية الآن.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !signedIn) return null;

  return <section className="account-card" aria-busy={busy}>
    <span>مزامنة حسابي</span>
    <h2>بياناتك بين أجهزتك</h2>
    <p>النسخة مرتبطة بحساب NAVIXA الحالي بدل رمز مزامنة منفصل. يتم التشفير على جهازك قبل الرفع، ولا تُرسل كلمة التشفير إلى الخادم.</p>
    <div className="account-status"><b>{found ? "نسخة سحابية مشفرة جاهزة" : "لا توجد نسخة سحابية بعد"}</b><small>{formatUpdatedAt(updatedAt)}</small></div>
    <label>كلمة التشفير
      <input type="password" value={passphrase} minLength={8} autoComplete="new-password" onChange={event => setPassphrase(event.target.value)} placeholder="8 أحرف على الأقل" />
    </label>
    <button type="button" disabled={busy} onClick={() => void upload()}>{busy ? "جارٍ التنفيذ…" : "رفع نسخة هذا الجهاز"}</button>
    <button type="button" className="account-secondary" disabled={busy || !found} onClick={() => void download()}>استعادة النسخة على هذا الجهاز</button>
    <button type="button" className="account-link" disabled={busy || !found} onClick={() => void remove()}>حذف النسخة السحابية</button>
    {notice && <p className="account-notice" role="status">{notice}</p>}
  </section>;
}
