"use client";

import {useEffect,useState} from "react";

type PlanId="monthly"|"sprint";
type Plan={id:PlanId;amount:number};
const defaults:Record<PlanId,number>={monthly:2900,sprint:1100};

export default function PlanPriceInline({plan,suffix=""}:{plan:PlanId;suffix?:string}){
  const [amount,setAmount]=useState(defaults[plan]);
  useEffect(()=>{fetch("/api/billing/catalog",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{const match=(data?.plans as Plan[]|undefined)?.find(item=>item.id===plan);if(match?.amount)setAmount(match.amount)}).catch(()=>{})},[plan]);
  return <strong className="canonical-plan-price">{(amount/100).toLocaleString("ar-SA",{maximumFractionDigits:2})} ر.س{suffix}</strong>;
}
