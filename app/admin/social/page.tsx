"use client";

import { useEffect, useState } from "react";
import "./social.css";
import { useAdminAuth } from "../useAdminAuth";

type SocialLinks = { x: string; instagram: string; youtube: string; github: string };

const DEFAULT_LINKS: SocialLinks = {
  x: "",
  instagram: "https://www.instagram.com/navixasa/",
  youtube: "",
  github: "",
};

const labels: Record<keyof SocialLinks, string> = {
  x: "رابط حساب X الرسمي",
  instagram: "رابط Instagram الرسمي",
  youtube: "رابط YouTube الرسمي",
  github: "رابط GitHub الرسمي",
};

const normalizeLinks = (value: unknown): SocialLinks => {
  const source = value && typeof value === "object" ? value as Partial<SocialLinks> : {};
  const valid = (item: unknown) => typeof item === "string" && /^https:\/\//.test(item.trim()) ? item.trim() : "";
  const x = valid(source.x);
  const instagram = valid(source.instagram);
  const youtube = valid(source.youtube);
  const github = valid(source.github);
  return {
    x: x === "https://x.com" || x === "https://x.com/" ? "" : x,
    instagram: instagram === "https://instagram.com" || instagram === "https://instagram.com/" ? DEFAULT_LINKS.instagram : instagram || DEFAULT_LINKS.instagram,
    youtube: youtube === "https://youtube.com" || youtube === "https://youtube.com/" ? "" : youtube,
    github: github === "https://github.com" || github === "https://github.com/" ? "" : github,
  };
};

export default function SocialAdmin() {
  const { allowed, checking } = useAdminAuth();
  const [saved, setSaved] = useState(false);
  const [links, setLinks] = useState<SocialLinks>(DEFAULT_LINKS);

  useEffect(() => {
    const raw = localStorage.getItem("navixa-social");
    if (!raw) return;
    try { setLinks(normalizeLinks(JSON.parse(raw))); } catch { setLinks(DEFAULT_LINKS); }
  }, []);

  if (checking || !allowed) return null;

  return <main className="social-admin" dir="rtl">
    <header><a href="/admin">← لوحة الإدارة</a><b className="social-brand"><img src="/navixa-mark.png" alt="" /> <span dir="ltr">NAVIXA <small className="brand-sa">SA</small></span></b></header>
    <section>
      <small>إعدادات الإدارة</small>
      <h1>حسابات التواصل الاجتماعي</h1>
      <p>لا يظهر للزوار إلا رابط حساب رسمي فعلي. أضف رابط X أو YouTube بعد إنشاء الحساب والتحقق منه؛ اترك الحقل فارغًا لإخفائه.</p>
      <form onSubmit={event => { event.preventDefault(); localStorage.setItem("navixa-social", JSON.stringify(normalizeLinks(links))); setSaved(true); }}>
        {Object.entries(links).map(([key, value]) => <label key={key}>{labels[key as keyof SocialLinks]}<input type="url" value={value} placeholder={key === "x" ? "https://x.com/اسم_الحساب" : key === "youtube" ? "https://youtube.com/@اسم_الحساب" : "https://"} onChange={event => setLinks({ ...links, [key]: event.target.value })} /></label>)}
        <button>حفظ وتطبيق</button>{saved && <em>✓ تم حفظ الروابط الرسمية فقط</em>}
      </form>
    </section>
  </main>;
}
