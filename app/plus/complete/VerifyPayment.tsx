"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type State={kind:"checking"|"success"|"failed";message:string;endsAt?:string};

export default function VerifyPayment({intentId,paymentId,status}:{intentId:string;paymentId:string;status:string}){
  const [state,setState]=useState<State>({kind:"checking",message:"نتحقق من عملية الدفع بأمان…"});
  useEffect(()=>{
    if(!intentId||!paymentId||status!=="paid"){setState({kind:"failed",message:"لم تكتمل عملية الدفع. لم يتم تفعيل أي اشتراك أو خصم مبلغ غير موثق."});return;}
    let active=true;
    fetch("/api/billing/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({intentId,paymentId})}).then(async response=>({ok:response.ok,data:await response.json().catch(()=>({}))})).then(({ok,data})=>{if(!active)return;if(ok)setState({kind:"success",message:"تم التحقق من الدفع وتفعيل NAVIXA Plus بنجاح.",endsAt:data.endsAt});else setState({kind:"failed",message:data.error||"تعذر التحقق من الدفع الآن. لا تحاول الدفع مرة أخرى؛ تواصل مع الدعم مع رقم العملية."});}).catch(()=>{if(active)setState({kind:"failed",message:"تعذر الاتصال بخدمة التحقق. لا تحاول الدفع مرة أخرى؛ تواصل مع الدعم مع رقم العملية."});});
    return()=>{active=false;};
  },[intentId,paymentId,status]);
  const end=state.endsAt?new Intl.DateTimeFormat("ar-SA",{dateStyle:"long"}).format(new Date(state.endsAt)):"";
  return <main className="plus-page" dir="rtl"><section className={`payment-result ${state.kind}`}><small>NAVIXA Plus</small><h1>{state.kind==="checking"?"لحظة واحدة":state.kind==="success"?"تم تفعيل اشتراكك":"نحتاج مراجعة عملية الدفع"}</h1><p>{state.message}</p>{end&&<p>ينتهي اشتراكك الحالي في: <b>{end}</b></p>}<div>{state.kind==="success"?<Link href="/#account">الذهاب إلى حسابي</Link>:<Link href="/plus#checkout">العودة إلى خيارات الاشتراك</Link>}</div></section></main>;
}
