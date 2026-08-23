import type { Metadata } from "next";
import Link from "next/link";
import { ar } from "../content/ar";
import AccountAccess from "./AccountAccess";
import "./account.css";

export const metadata: Metadata = { title: "دخول NAVIXA", description: "دخول سريع وآمن إلى تجربة NAVIXA Plus" };

export default function AccountPage() {
  return <main className="account-page" dir="rtl"><nav className="account-nav"><Link href="/" className="account-brand"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/plus">NAVIXA Plus ←</Link></nav><section className="account-shell"><div className="account-copy"><small>{ar.account.eyebrow}</small><h1>{ar.account.titleFirst} <strong>{ar.account.titleEmphasis}</strong><br/>{ar.account.titleLast}</h1><p>{ar.account.description}</p><div className="account-trust"><span>✓ {ar.account.noPassword}</span><span>✓ {ar.account.noLocalContent}</span><span>✓ {ar.account.clearLogout}</span></div></div><AccountAccess/></section></main>;
}
