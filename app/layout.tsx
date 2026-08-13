import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA | ذكاء يفهم يومك",
  description: "مساعد ذكي يجمع العمل والمشاريع والمهام والتركيز والأتمتة في مكان واحد.",
  icons: { icon: "/navixa-logo-clean.png", apple: "/navixa-logo-clean.png" },
  openGraph: {title:"NAVIXA | ذكاء يفهم يومك",description:"مساعد ذكي لحياة أكثر ترتيبًا.",images:["/navixa-logo-clean.png"]},
  twitter: {card:"summary_large_image",title:"NAVIXA | ذكاء يفهم يومك",description:"مساعد ذكي لحياة أكثر ترتيبًا.",images:["/navixa-logo-clean.png"]},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
