import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مركز الورد اليومي",
  description: "مركز NAVIXA SA لمواقيت الصلاة والأذكار وورد القرآن في مكان واحد.",
  alternates: { canonical: "/worship" },
  openGraph: { title: "مركز الورد اليومي | NAVIXA SA", description: "مواقيت الصلاة والأذكار وورد القرآن في مكان واحد.", url: "/worship", images: ["/navixa-share.png"] },
};

export default function WorshipLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
