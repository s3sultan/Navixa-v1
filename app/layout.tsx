import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA | ذكاء يفهم يومك",
  description: "مساعد سعودي ذكي يجمع الدراسة والعمل والمهام والتركيز والأتمتة في مكان واحد.",
  openGraph: {title:"NAVIXA | ذكاء يفهم يومك",description:"مساعد سعودي ذكي لحياة أكثر ترتيبًا.",images:["/og.png"]},
  twitter: {card:"summary_large_image",title:"NAVIXA | ذكاء يفهم يومك",description:"مساعد سعودي ذكي لحياة أكثر ترتيبًا.",images:["/og.png"]},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
