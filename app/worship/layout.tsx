import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مركز الورد اليومي",
  description: "مركز NAVIXA لمواقيت الصلاة والأذكار وورد القرآن في مكان واحد.",
  alternates: { canonical: "/worship" },
  openGraph: { title: "مركز الورد اليومي | NAVIXA", description: "مواقيت الصلاة والأذكار وورد القرآن في مكان واحد.", url: "/worship", images: ["/navixa-mark.png"] },
};

export default function WorshipLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
