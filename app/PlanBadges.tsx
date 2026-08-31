import Link from "next/link";

type Props={sprint?:boolean;plus?:boolean;compact?:boolean};

export default function PlanBadges({sprint=false,plus=false,compact=false}:Props){
  if(!sprint&&!plus)return null;
  const badge:React.CSSProperties={display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:compact?24:28,padding:compact?"2px 7px":"3px 9px",borderRadius:999,border:"1px solid currentColor",fontSize:compact?10:11,fontWeight:900,textDecoration:"none",lineHeight:1.2};
  return <span aria-label="الباقات المتاحة" style={{display:"inline-flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
    {sprint?<Link href="/sprint" title="تفاصيل NAVIXA Sprint" style={badge}>SPRINT</Link>:null}
    {plus?<Link href="/plus" title="تفاصيل NAVIXA Plus" style={badge}>PLUS</Link>:null}
  </span>;
}
