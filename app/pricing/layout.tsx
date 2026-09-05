import type {Metadata} from "next";

export const metadata:Metadata={
  title:"الأسعار",
  description:"قائمة أسعار NAVIXA الرسمية لباقتي هِمّة وعَزْم بالريال السعودي.",
  alternates:{canonical:"/pricing"},
  robots:{index:true,follow:true},
};

export default function PricingLayout({children}:{children:React.ReactNode}){return children}
