import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مركز صحتي",
  description: "مركز NAVIXA للصحة: متابعة الحركة والجلوس والماء بخصوصية محلية.",
  alternates: { canonical: "/health" },
  openGraph: { title: "مركز صحتي | NAVIXA", description: "متابعة الحركة والجلوس والماء بخصوصية محلية.", url: "/health", images: ["/navixa-logo-clean.png"] },
};

export default function HealthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
