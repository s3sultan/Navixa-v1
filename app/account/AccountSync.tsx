"use client";

import { useEffect, useState } from "react";
import { decryptSyncPayload, encryptSyncPayload, normalizeSyncPassphrase } from "../../lib/accountSyncCrypto";

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
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
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
    const normalized = normalizeSyncPassphrase(passphrase);
    if (normalized.length >= 8) return passphrase;
    setNotice("اكتب كلمة تشفير من 8 أحرف على الأقل. لا تُحفظ ولا تُرسل إلى NAVIXA.");
    return null;
  };

  const validateUploadPassphrase = () => {
    const value = validatePassphrase();
    if (!value) return null;
    if (normalizeSyncPassphrase(passphraseConfirm) !== normalizeSyncPassphrase(value)) {
      setNotice("تأكيد كلمة التشفير غير مطابق. لم نرفع أو نغيّر أي نسخة.");
      return null;
    }
    return value;
  };

  const upload = async () => {
    const encryptionPassphrase = validateUploadPassphrase();
    if (!encryptionPassphrase) return;
    setBusy(true);
    setNotice(found ? "جارٍ التحقق من كلمة التشفير قبل استبدال النسخة الحالية…" : "جارٍ تشفير بيانات هذا الجهاز محليًا…");
    try {
      let expectedVersion = version;
      if (found) {
        const currentResponse = await fetch("/api/sync", { cache: "no-store", credentials: "same-origin" });
        const current = await currentResponse.json().catch(() => ({})) as SyncResponse;
        if (!currentResponse.ok || !current.found || typeof current.payload !== "string") throw new Error("current-backup-unavailable");
        await decryptSyncPayload(current.payload, encryptionPassphrase);
        expectedVersion = Number(current.version) || expectedVersion;
        setVersion(expectedVersion);
      }

      setNotice("جارٍ تشفير بيانات هذا الجهاز محليًا…");
      const plain = JSON.stringify({
        format: "NAVIXA_LOCAL_BACKUP",
        version: 1,
        createdAt: new Date().toISOString(),
        data: Object.fromEntries(backupKeys().map(key => [key, localStorage.getItem(key)])),
      });
      if (plain.length > 640_000) throw new Error("too-large");
      const payload = await encryptSyncPayload(plain, encryptionPassphrase);
      const body: Record<string, unknown> = { payload };
      if (expectedVersion > 0) body.expectedVersion = expectedVersion;
      const response = await fetch("/api/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as SyncResponse;
      if (response.status === 409 || data.conflict) {
        setVersion(Number(data.currentVersion) || expectedVersion);
        setNotice("يوجد تحديث أحدث من جهاز آخر. استعد النسخة أولًا ثم قرر ما تريد رفعه.");
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "upload-failed");
      setFound(true);
      setVersion(Number(data.version) || Math.max(1, expectedVersion + 1));
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString());
      setPassphraseConfirm("");
      setNotice("تم رفع نسخة مشفرة مرتبطة بحسابك. كلمة التشفير بقيت على هذا الجهاز فقط.");
    } catch (error) {
      if (error instanceof Error && error.message === "passphrase-mismatch") {
        setNotice("كلمة التشفير لا تطابق النسخة السحابية الحالية، لذلك لم نستبدلها. إذا نسيتها، احذف النسخة السحابية ثم أنشئ نسخة جديدة من جهازك الأصلي.");
      } else if (error instanceof Error && error.message === "too-large") {
        setNotice("حجم البيانات المحلية أكبر من حد المزامنة الحالي. استخدم التصدير المحلي مؤقتًا.");
      } else {
        setNotice("تعذر رفع النسخة الآن. بيانات جهازك والنسخة السحابية لم تتغير.");
      }
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const decryptionPassphrase = validatePassphrase();
    if (!decryptionPassphrase) return;
    setBusy(true);
    setNotice("جارٍ جلب النسخة المشفرة وفكها على هذا الجهاز…");
    try {
      const response = await fetch("/api/sync", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({})) as SyncResponse;
      if (!response.ok || !data.found || typeof data.payload !== "string") throw new Error("not-found");
      const plain = await decryptSyncPayload(data.payload, decryptionPassphrase);
      const backup = JSON.parse(plain) as { format?: string; data?: Record<string, unknown> };
      if (backup.format !== "NAVIXA_LOCAL_BACKUP" || !backup.data || typeof backup.data !== "object") throw new Error("invalid-backup");
      for (const [key, value] of Object.entries(backup.data)) {
        if (key.startsWith("navixa-") || key.startsWith("navixa_")) localStorage.setItem(key, String(value ?? ""));
      }
      setVersion(Number(data.version) || version);
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : updatedAt);
      setNotice("تمت الاستعادة بنجاح. سيُعاد تحميل NAVIXA لتطبيق بياناتك.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      if (error instanceof Error && error.message === "passphrase-mismatch") {
        setNotice("كلمة التشفير لا تطابق النسخة السحابية. لم نغيّر أي بيانات على هذا الجهاز.");
      } else if (error instanceof Error && error.message === "invalid-envelope") {
        setNotice("النسخة السحابية غير صالحة للاستعادة. لم نغيّر أي بيانات على هذا الجهاز.");
      } else {
        setNotice("تعذر الاستعادة الآن. النسخة السحابية لم تُحذف وبيانات هذا الجهاز لم تتغير.");
      }
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
      setPassphraseConfirm("");
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
    <label>تأكيد كلمة التشفير للرفع
      <input type="password" value={passphraseConfirm} minLength={8} autoComplete="new-password" onChange={event => setPassphraseConfirm(event.target.value)} placeholder="أعد كتابتها قبل رفع النسخة" />
    </label>
    <button type="button" disabled={busy} onClick={() => void upload()}>{busy ? "جارٍ التنفيذ…" : "رفع نسخة هذا الجهاز"}</button>
    <button type="button" className="account-secondary" disabled={busy || !found} onClick={() => void download()}>استعادة النسخة على هذا الجهاز</button>
    <button type="button" className="account-link" disabled={busy || !found} onClick={() => void remove()}>حذف النسخة السحابية</button>
    {notice && <p className="account-notice" role="status">{notice}</p>}
  </section>;
}
