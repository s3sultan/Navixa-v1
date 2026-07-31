import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA Smart Garden | حديقتك تنمو بذكاء",
  description: "منصة احترافية لإدارة وأتمتة الحدائق الذكية بالكامل.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
