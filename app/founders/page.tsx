import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata={
  title:"NAVIXA Plus",
  description:"NAVIXA مفتوح للتجربة المجانية حاليًا، وعروض الاشتراك غير معروضة للبيع خلال هذه الفترة.",
  robots:{index:false,follow:false},
};

export default function FoundersPage(){redirect("/plus")}
