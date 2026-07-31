import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA | ذكاء يفهم وينفّذ عنك",
  description: "NAVIXA يسمع اسمك، يراقب شاشتك، يذكّرك بمهامك، ويدير مزرعتك تلقائيًا.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
