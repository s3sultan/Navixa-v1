import type { Metadata } from "next";
import PerformanceReporter from "./PerformanceReporter";
import NavixaSplash from "./NavixaSplash";
import DirectEntry from "./DirectEntry";
import "./globals.css";
import "./mobile-spacing-fix.css";

const siteUrl = "https://navixasa.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "NAVIXA SA — يفهم يومك", template: "%s — NAVIXA SA" },
  description: "NAVIXA SA مساعد ذكي يرتب يومك، يساعدك على التركيز والصحة والمهام والأتمتة مع خصوصية محلية.",
  applicationName: "NAVIXA SA",
  keywords: ["NAVIXA SA", "NAVIXA", "مساعد ذكي", "تنظيم المهام", "التركيز", "الصحة", "الأتمتة", "مساعد عربي"],
  authors: [{ name: "NAVIXA SA" }], creator: "NAVIXA SA", publisher: "NAVIXA SA", category: "productivity",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/navixa-sa-icon.svg", apple: "/apple-touch-icon.png", shortcut: "/navixa-sa-icon.svg" },
  openGraph: { type: "website", locale: "ar_SA", url: siteUrl, siteName: "NAVIXA SA", title: "NAVIXA SA — يفهم يومك", description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.", images: [{ url: "/navixa-share.png", width: 1200, height: 630, alt: "NAVIXA SA — مساعدك الذكي، حاضر في التفاصيل التي تهمك" }] },
  twitter: { card: "summary_large_image", title: "NAVIXA SA — يفهم يومك", description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.", images: ["/navixa-share.png"] },
};

const structuredData={"@context":"https://schema.org","@type":"WebApplication",name:"NAVIXA SA",url:siteUrl,description:"مساعد ذكي يرتب يومك ويساعدك على التركيز والصحة والمهام والأتمتة.",applicationCategory:"ProductivityApplication",operatingSystem:"Web",inLanguage:"ar",image:`${siteUrl}/navixa-share.png`,offers:{"@type":"Offer",price:"0",priceCurrency:"SAR"}};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body><script src="/navixa-appearance-bootstrap.js" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><DirectEntry /><NavixaSplash /><PerformanceReporter />{children}</body></html>;
}
