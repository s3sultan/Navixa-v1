import type { Metadata, Viewport } from "next";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "مركز صحتي",
  description: "مركز NAVIXA SA للصحة: متابعة الحركة والجلوس والماء بخصوصية محلية.",
  alternates: { canonical: "/health" },
  openGraph: { title: "مركز صحتي | NAVIXA SA", description: "متابعة الحركة والجلوس والماء بخصوصية محلية.", url: "/health", images: ["/opengraph-image"] },
};

export default function HealthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
