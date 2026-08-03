import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA | اجلس بوعي وتحرك في وقتك",
  description: "رفيق صحة مكتبي يراقب وضعية الجلوس محليًا ويذكّرك بالحركة والماء مع خصوصية كاملة.",
  openGraph: {title:"NAVIXA | اجلس بوعي",description:"رفيقك لجلسة عمل أكثر صحة ووعيًا.",images:["/og-health.png"]},
  twitter: {card:"summary_large_image",title:"NAVIXA | اجلس بوعي",description:"رفيقك لجلسة عمل أكثر صحة ووعيًا.",images:["/og-health.png"]},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
