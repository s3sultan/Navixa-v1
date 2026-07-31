import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAVIXA | ذكاء يفهم وينفّذ عنك",
  description: "NAVIXA يراقب حديقتك، يفهم احتياجها، ويتخذ القرار وينفذه تلقائيًا.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
