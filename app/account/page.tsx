import type { Metadata } from "next";
import Link from "next/link";
import AccountAccess from "./AccountAccess";
import "./account.css";

export const metadata: Metadata = { title: "دخول NAVIXA", description: "دخول سريع وآمن إلى تجربة NAVIXA Plus" };

export default function AccountPage() {
  return <main className="account-page" dir="rtl"><nav className="account-nav"><Link href="/" className="account-brand"><img src="/navixa-mark.webp" alt=""/><span><b>NAVIXA</b><small>يفهم يومك</small></span></Link><Link href="/plus">NAVIXA Plus ←</Link></nav><section className="account-shell"><div className="account-copy"><small>دخول آمن بلا كلمة مرور</small><h1>حسابك يثبت <strong>اشتراكك</strong><br/>ولا يلمس خصوصيتك.</h1><p>نستخدم رمزًا قصيرًا يصل إلى بريدك، ثم يمكنك تفعيل الدخول السريع ببصمة الجهاز أو Face ID عند توفره.</p><div className="account-trust"><span>✓ لا كلمة مرور</span><span>✓ لا صوت أو نصوص في الحساب</span><span>✓ تسجيل خروج واضح</span></div></div><AccountAccess/></section></main>;
}
