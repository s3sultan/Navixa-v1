import type { Metadata } from "next";
import PerformanceReporter from "./PerformanceReporter";
import NavixaSplash from "./NavixaSplash";
import "./globals.css";

const siteUrl = "https://navixasa.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NAVIXA SA — يفهم يومك",
    template: "%s — NAVIXA SA",
  },
  description: "NAVIXA SA مساعد ذكي يرتب يومك، يساعدك على التركيز والصحة والمهام والأتمتة مع خصوصية محلية.",
  applicationName: "NAVIXA SA",
  keywords: ["NAVIXA SA", "NAVIXA", "مساعد ذكي", "تنظيم المهام", "التركيز", "الصحة", "الأتمتة", "مساعد عربي"],
  authors: [{ name: "NAVIXA SA" }],
  creator: "NAVIXA SA",
  publisher: "NAVIXA SA",
  category: "productivity",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/navixa-sa-icon.svg", apple: "/navixa-sa-icon.svg", shortcut: "/navixa-sa-icon.svg" },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    url: siteUrl,
    siteName: "NAVIXA SA",
    title: "NAVIXA SA — يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "NAVIXA SA — مساعدك الذكي، حاضر في التفاصيل التي تهمك" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NAVIXA SA — يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: ["/opengraph-image"],
  },
};

const appearanceBootstrap=`(()=>{try{const mode=localStorage.getItem("navixa-appearance-mode")||"system";const palette=localStorage.getItem("navixa-appearance-palette")||"oasis";const dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;const theme=mode==="system"?(dark?"dark":"light"):(mode==="dark"?"dark":"light");document.documentElement.dataset.navixaTheme=theme;document.documentElement.dataset.navixaPalette=["oasis","lilac","midnight","sand"].includes(palette)?palette:"oasis";document.documentElement.style.colorScheme=theme}catch{}})()`;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
name: "NAVIXA SA",
    url: siteUrl,
    description: "مساعد ذكي يرتب يومك ويساعدك على التركيز والصحة والمهام والأتمتة.",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  inLanguage: "ar",
  image: `${siteUrl}/opengraph-image`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><NavixaSplash /><PerformanceReporter />{children}</body></html>;
}
