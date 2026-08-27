"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type State={kind:"checking"|"success"|"failed";message:string;endsAt?:string};

export default function VerifyPayment({intentId,paymentId,status,provider}:{intentId:string;paymentId:string;status:string;provider:string}){
  const [state,setState]=useState<State>({kind:"checking",message:"نتحقق من عملية الدفع بأمان…"});
  useEffect(()=>{
    // لا يوفر رابط عودة سلة إثبات دفع موثوقًا. تظهر هذه الحالة فقط عند ربط سلة فعليًا،
    // وتبقى معلقة حتى تؤكد نقطة Webhook الموقعة والتحقق الخادمي الاستحقاق.
    if(provider==="salla"){
      if(!intentId){setState({kind:"failed",message:"رابط العودة غير صالح. لم يتم تفعيل أي اشتراك أو خصم مبلغ."});return;}
      let active=true,attempt=0,timer:number|undefined;
      const check=async()=>{
        const response=await fetch(`/api/billing/salla/entitlement?intent=${encodeURIComponent(intentId)}`,{cache:"no-store",credentials:"same-origin"});
        const data=await response.json().catch(()=>({}));
        if(!active)return;
        if(response.ok&&data.state==="active"){setState({kind:"success",message:"تم تأكيد الاستحقاق خادميًا وتفعيل NAVIXA Plus.",endsAt:data.endsAt});return;}
        if(response.ok&&data.state==="not_activated"){setState({kind:"failed",message:"لم يُؤكَّد الاشتراك في NAVIXA. لا تعتمد هذه الصفحة كإثبات دفع؛ تواصل مع الدعم قبل محاولة شراء جديدة."});return;}
        if(response.status===401){setState({kind:"failed",message:"سجّل الدخول إلى حساب NAVIXA نفسه لمراجعة حالة الاشتراك. لا يتم التفعيل من رابط العودة وحده."});return;}
        attempt+=1;
        setState({kind:"checking",message:"عدت من سلة. نتحقق من الدفع عبر تأكيد خادمي موقّع قبل تفعيل الاشتراك. لا تعتمد هذه الصفحة وحدها كإثبات للدفع."});
        if(attempt<5)timer=window.setTimeout(()=>{void check();},3000);
      };
      void check();
      return()=>{active=false;if(timer)window.clearTimeout(timer);};
    }
    if(!intentId||!paymentId||status!=="paid"){setState({kind:"failed",message:"لم تكتمل عملية الدفع. لم يتم تفعيل أي اشتراك أو خصم مبلغ غير موثق."});return;}
    let active=true;
    fetch("/api/billing/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({intentId,paymentId})}).then(async response=>({ok:response.ok,data:await response.json().catch(()=>({}))})).then(({ok,data})=>{if(!active)return;if(ok)setState({kind:"success",message:"تم التحقق من الدفع وتفعيل NAVIXA Plus بنجاح.",endsAt:data.endsAt});else setState({kind:"failed",message:data.error||"تعذر التحقق من الدفع الآن. لا تحاول الدفع مرة أخرى؛ تواصل مع الدعم مع رقم العملية."});}).catch(()=>{if(active)setState({kind:"failed",message:"تعذر الاتصال بخدمة التحقق. لا تحاول الدفع مرة أخرى؛ تواصل مع الدعم مع رقم العملية."});});
    return()=>{active=false;};
  },[intentId,paymentId,status,provider]);
  const end=state.endsAt?new Intl.DateTimeFormat("ar-SA",{dateStyle:"long"}).format(new Date(state.endsAt)):"";
  return <main className="plus-page" dir="rtl"><section className={`payment-result ${state.kind}`}><small>NAVIXA Plus</small><h1>{state.kind==="checking"?"لحظة واحدة":state.kind==="success"?"تم تفعيل اشتراكك":"نحتاج مراجعة عملية الدفع"}</h1><p>{state.message}</p>{end&&<p>ينتهي اشتراكك الحالي في: <b>{end}</b></p>}<div>{state.kind==="success"?<Link href="/#account">الذهاب إلى حسابي</Link>:<Link href="/plus#checkout">العودة إلى خيارات الاشتراك</Link>}</div></section></main>;
}
