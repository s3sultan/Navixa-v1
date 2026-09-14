import type { Metadata, Viewport } from "next";
import Script from "next/script";
import PerformanceReporter from "./PerformanceReporter";
import VisitorCounter from "./VisitorCounter";
import DirectEntry from "./DirectEntry";
import PricingHeaderShortcut from "./PricingHeaderShortcut";
import PushSubscriptionBootstrap from "./PushSubscriptionBootstrap";
import DeviceControlAgent from "./DeviceControlAgent";
import DeferredAppAgents from "./DeferredAppAgents";
import "./globals.css";
import "./mobile-spacing-fix.css";
import "./direct-entry.css";
import "./public-pricing.css";
import "./pricing-header-shortcut.css";
import "./worship-smart.css";
import "./visitor-counter.css";
import "./health-disabled.css";

const siteUrl = "https://navixasa.com";
const alexandriaStylesheet = "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&display=swap";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "NAVIXA | مساعد ذكي لتنظيم يومك ومتابعة المحاضرات", template: "%s | NAVIXA" },
  description: "NAVIXA مساعد ذكي عربي لتنظيم يومك ومتابعة المحاضرات والاجتماعات، التنبيه عند ذكر اسمك، مراقبة الشاشة، التذكيرات الذكية وأدوات التركيز والصحة والعبادة مع اهتمام بالخصوصية.",
  applicationName: "NAVIXA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "NAVIXA", statusBarStyle: "default" },
  keywords: ["NAVIXA", "نافيكسا", "مساعد ذكي عربي", "تنظيم اليوم", "متابعة المحاضرات", "تنبيه عند ذكر الاسم", "مراقبة الشاشة", "تذكيرات ذكية", "تلخيص المحاضرات", "تلخيص الاجتماعات", "تنظيم المهام", "التركيز", "الإنتاجية"],
  authors: [{ name: "NAVIXA" }], creator: "NAVIXA", publisher: "NAVIXA", category: "productivity",
  alternates: { languages: { "ar-SA": "/" } },
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
  return <html lang="ar" dir="rtl" suppressHydrationWarning>
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={alexandriaStylesheet} />
    </head>
    <body>
      <Script src="/navixa-appearance-bootstrap.js" strategy="beforeInteractive" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <DirectEntry />
      <PerformanceReporter />
      <PushSubscriptionBootstrap />
      <DeviceControlAgent />
      <DeferredAppAgents />
      {children}
      <VisitorCounter />
      <PricingHeaderShortcut />
    </body>
  </html>;
}
