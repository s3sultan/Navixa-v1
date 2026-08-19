import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://navixa.s2shug.workers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NAVIXA — يفهم يومك",
    template: "%s — NAVIXA",
  },
  description: "NAVIXA مساعد ذكي يرتب يومك، يساعدك على التركيز والصحة والمهام والأتمتة مع خصوصية محلية.",
  applicationName: "NAVIXA",
  keywords: ["NAVIXA", "مساعد ذكي", "تنظيم المهام", "التركيز", "الصحة", "الأتمتة", "مساعد عربي"],
  authors: [{ name: "NAVIXA" }],
  creator: "NAVIXA",
  publisher: "NAVIXA",
  category: "productivity",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/navixa-mark.png", apple: "/navixa-mark.png" },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    url: siteUrl,
    siteName: "NAVIXA",
    title: "NAVIXA — يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: [{ url: "/navixa-logo-clean.png", width: 720, height: 613, alt: "NAVIXA — يفهم يومك" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NAVIXA — يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: ["/navixa-logo-clean.png"],
  },
};

const appearanceBootstrap=`(()=>{try{const mode=localStorage.getItem("navixa-appearance-mode")||"system";const palette=localStorage.getItem("navixa-appearance-palette")||"oasis";const dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;const theme=mode==="system"?(dark?"dark":"light"):(mode==="dark"?"dark":"light");document.documentElement.dataset.navixaTheme=theme;document.documentElement.dataset.navixaPalette=["oasis","lilac","midnight","sand"].includes(palette)?palette:"oasis";document.documentElement.style.colorScheme=theme}catch{}})()`;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "NAVIXA",
  url: siteUrl,
  description: "مساعد ذكي يرتب يومك ويساعدك على التركيز والصحة والمهام والأتمتة.",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  inLanguage: "ar",
  image: `${siteUrl}/navixa-logo-clean.png`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body></html>;
}
