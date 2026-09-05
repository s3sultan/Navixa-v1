import type { Metadata, Viewport } from "next";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "الصحة أثناء الدراسة والعمل",
  description: "أدوات NAVIXA لتذكيرات الحركة والراحة والماء والعادات الصحية أثناء الدراسة والعمل، مع تحكم محلي واهتمام بالخصوصية.",
  alternates: { canonical: "/health" },
  robots: { index: true, follow: true },
  openGraph: { title: "الصحة أثناء الدراسة والعمل | NAVIXA", description: "تذكيرات للحركة والراحة والماء والعادات الصحية أثناء الدراسة والعمل داخل NAVIXA.", url: "/health", images: ["/navixa-share.png"] },
};

export default function HealthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
