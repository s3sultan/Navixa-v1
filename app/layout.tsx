import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://navixa.s2shug.workers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NAVIXA | ذكاء يفهم يومك",
    template: "%s | NAVIXA",
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
    title: "NAVIXA | ذكاء يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: [{ url: "/navixa-logo-clean.png", width: 720, height: 613, alt: "NAVIXA | ذكاء يفهم يومك" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NAVIXA | ذكاء يفهم يومك",
    description: "مساعد ذكي لحياة أكثر ترتيبًا مع خصوصية محلية.",
    images: ["/navixa-logo-clean.png"],
  },
};

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
  return <html lang="ar" dir="rtl"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body></html>;
}
