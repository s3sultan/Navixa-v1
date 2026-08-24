import type { Metadata } from "next";
import MeetingStudio from "./MeetingStudio";
import FeatureAccessGate from "../FeatureAccessGate";

export const metadata: Metadata = {
  title: "سجّل ولخّص",
  description: "سجّل محاضرة أو اجتماعًا بإذن واضح، ثم راجع نصًا وملخصًا محليين على جهازك.",
  alternates: { canonical: "/meetings" },
  openGraph: { title: "سجّل ولخّص | NAVIXA", description: "تسجيل وتلخيص محليان بإذن واضح وخصوصية أولًا.", url: "/meetings", images: ["/navixa-logo-clean.png"] },
};

export default function MeetingsPage() {
  return <FeatureAccessGate feature="تسجيل وتلخيص الاجتماعات"><MeetingStudio /></FeatureAccessGate>;
}
