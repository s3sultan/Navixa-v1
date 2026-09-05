import type { Metadata } from "next";
import Script from "next/script";
import PerformanceReporter from "./PerformanceReporter";
import VisitorReporter from "./VisitorReporter";
import VisitorCounter from "./VisitorCounter";
import NavixaSplash from "./NavixaSplash";
import DirectEntry from "./DirectEntry";
import PricingHeaderShortcut from "./PricingHeaderShortcut";
import "./globals.css";
import "./mobile-spacing-fix.css";
import "./direct-entry.css";
import "./public-pricing.css";
import "./pricing-header-shortcut.css";
import "./worship-smart.css";
import "./visitor-counter.css";

const siteUrl = "https://navixasa.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "NAVIXA | مساعد ذكي لتنظيم يومك ومتابعة المحاضرات", template: "%s | NAVIXA" },
  description: "NAVIXA مساعد ذكي عربي لتنظيم يومك ومتابعة المحاضرات والاجتماعات، التنبيه عند ذكر اسمك، مراقبة الشاشة، التذكيرات الذكية وأدوات التركيز والصحة والعبادة مع اهتمام بالخصوصية.",
  applicationName: "NAVIXA",
  keywords: ["NAVIXA", "نافيكسا", "مساعد ذكي عربي", "تنظيم اليوم", "متابعة المحاضرات", "تنبيه عند ذكر الاسم", "مراقبة الشاشة", "تذكيرات ذكية", "تلخيص المحاضرات", "تلخيص الاجتماعات", "تنظيم المهام", "التركيز", "الإنتاجية"],
  authors: [{ name: "NAVIXA" }], creator: "NAVIXA", publisher: "NAVIXA", category: "productivity",
  alternates: { canonical: "/", languages: { "ar-SA": "/" } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/navixa-sa-icon.svg", apple: "/apple-touch-icon.png", shortcut: "/navixa-sa-icon.svg" },
  openGraph: { type: "website", locale: "ar_SA", url: siteUrl, siteName: "NAVIXA", title: "NAVIXA | يفهم يومك", description: "مساعد ذكي عربي لتنظيم يومك ومتابعة المحاضرات والاجتماعات والتنبيهات الذكية مع اهتمام بالخصوصية.", images: [{ url: "/navixa-share.png", width: 1200, height: 630, alt: "NAVIXA يفهم يومك" }] },
  twitter: { card: "summary_large_image", title: "NAVIXA | يفهم يومك", description: "مساعد ذكي عربي لتنظيم يومك ومتابعة المحاضرات والاجتماعات والتنبيهات الذكية.", images: ["/navixa-share.png"] },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "NAVIXA", url: siteUrl, logo: `${siteUrl}/navixa-sa-icon.svg` },
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "NAVIXA", inLanguage: "ar-SA", publisher: { "@id": `${siteUrl}/#organization` } },
    { "@type": "WebApplication", "@id": `${siteUrl}/#app`, name: "NAVIXA", url: siteUrl, description: "مساعد ذكي عربي لتنظيم اليوم ومتابعة المحاضرات والاجتماعات والتنبيهات الذكية.", applicationCategory: "ProductivityApplication", operatingSystem: "Web", inLanguage: "ar-SA", image: `${siteUrl}/navixa-share.png`, publisher: { "@id": `${siteUrl}/#organization` } }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body><Script src="/navixa-appearance-bootstrap.js" strategy="beforeInteractive" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><DirectEntry /><NavixaSplash /><PerformanceReporter /><VisitorReporter />{children}<VisitorCounter /><PricingHeaderShortcut /></body></html>;
}
