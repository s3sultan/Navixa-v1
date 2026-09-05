import Link from "next/link";

export default function LegalPolicyNav({current}:{current:"terms"|"privacy"|"refunds"|"support"}){
  const items=[
    {id:"terms",href:"/terms",label:"الشروط والأحكام"},
    {id:"privacy",href:"/privacy",label:"الخصوصية"},
    {id:"refunds",href:"/refunds",label:"الإلغاء والاسترداد"},
    {id:"support",href:"/support",label:"الدعم"},
  ] as const;
  return <nav className="legal-policy-nav" aria-label="سياسات NAVIXA">{items.map(item=><Link key={item.id} href={item.href} aria-current={current===item.id?"page":undefined} className={current===item.id?"active":""}>{item.label}</Link>)}</nav>;
}
