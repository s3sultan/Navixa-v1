"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";

type Plan="monthly"|"quarterly";
type CheckoutPayload={intentId:string;publicKey:string;amount:number;currency:string;description:string;callbackUrl:string;metadata:Record<string,string>;methods:string[];supportedNetworks:string[];applePay:{country:string;label:string;validateMerchantUrl:string}|null};
type CheckoutAvailability={available:boolean;message:string};

type MoyasarOptions={element:string;amount:number;currency:string;description:string;publishable_api_key:string;callback_url:string;supported_networks:string[];methods:string[];metadata:Record<string,string>;apple_pay?:{country:string;label:string;validate_merchant_url:string}};

declare global {interface Window { Moyasar?:{init:(options:MoyasarOptions)=>void} }}

const scriptUrl="https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.2.10/dist/moyasar.umd.min.js";
const styleUrl="https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.2.10/dist/moyasar.css";

function loadMoyasar(){
  if(window.Moyasar)return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-navixa-moyasar="true"]');
    if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("script")),{once:true});return;}
    if(!document.querySelector(`link[href="${styleUrl}"]`)){const link=document.createElement("link");link.rel="stylesheet";link.href=styleUrl;document.head.appendChild(link);}
    const script=document.createElement("script");script.src=scriptUrl;script.async=true;script.dataset.navixaMoyasar="true";script.onload=()=>resolve();script.onerror=()=>reject(new Error("script"));document.head.appendChild(script);
  });
}

export default function CheckoutPanel(){
  const searchParams=useSearchParams();
  const foundersIntentId=searchParams.get("founders_intent")||"";
  const [plan,setPlan]=useState<Plan>("monthly");
  const [discountCode,setDiscountCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [availability,setAvailability]=useState<CheckoutAvailability|null>(null);
  const formRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{let active=true;fetch("/api/billing/checkout",{cache:"no-store"}).then(async response=>({ok:response.ok,data:await response.json().catch(()=>null)})).then(({ok,data})=>{if(active&&ok&&data)setAvailability(data as CheckoutAvailability)}).catch(()=>{if(active)setAvailability({available:false,message:"الاشتراك المدفوع يفتح قريبًا. ابدأ تجربة Plus الآن."})});return()=>{active=false};},[]);

  const start=async()=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan,discountCode,foundersIntentId})});
      const data=await response.json().catch(()=>({})) as CheckoutPayload&{error?:string};
      if(!response.ok)throw new Error(data.error||"تعذر تجهيز الدفع الآن");
      await loadMoyasar();
      if(!window.Moyasar||!formRef.current)throw new Error("تعذر تجهيز نموذج الدفع");
      formRef.current.innerHTML="";
      window.Moyasar.init({element:".navixa-moyasar-form",amount:data.amount,currency:data.currency,description:data.description,publishable_api_key:data.publicKey,callback_url:data.callbackUrl,supported_networks:data.supportedNetworks,methods:data.methods,metadata:data.metadata,...(data.applePay?{apple_pay:{country:data.applePay.country,label:data.applePay.label,validate_merchant_url:data.applePay.validateMerchantUrl}}:{})});
      setNotice("اختر وسيلة الدفع المناسبة. لن يتم تفعيل الاشتراك إلا بعد التحقق من العملية.");
    }catch(error){setNotice(error instanceof Error?error.message:"تعذر تجهيز الدفع الآن. حاول لاحقًا أو تواصل مع الدعم.");}
    finally{setBusy(false);}
  };
  const startSallaManualReview=async()=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/billing/salla/manual-review",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:"{}"});
      const data=await response.json().catch(()=>({})) as {checkoutUrl?:string;error?:string};
      if(!response.ok||!data.checkoutUrl)throw new Error(data.error||"تعذر تجهيز المراجعة الآن");
      window.location.assign(data.checkoutUrl);
    }catch(error){setNotice(error instanceof Error?error.message:"تعذر الانتقال إلى سلة الآن. سجّل الدخول إلى NAVIXA أولًا ثم حاول مرة أخرى.");}
    finally{setBusy(false);}
  };

  return <section className="plus-checkout" id="checkout" aria-labelledby="checkout-title">
    <header><small>اشتراك عبر سلة</small><h2 id="checkout-title">ابدأ طلبك ثم أكمل الدفع في سلة</h2><p>سجّل الدخول إلى NAVIXA أولًا. بعد الدفع تظل الحالة «بانتظار المراجعة» حتى يطابق المدير الطلب المدفوع من لوحة سلة؛ لا يفعّل الرابط وحده اشتراكًا.</p></header>
    <div className="checkout-options" role="radiogroup" aria-label="الباقة">
      <label className={plan==="monthly"?"selected":""}><input type="radio" name="plan" value="monthly" checked={plan==="monthly"} onChange={()=>setPlan("monthly")}/><span><b>Plus الشهري</b><small>19 ر.س شهريًا</small></span></label>
      <label className={plan==="quarterly"?"selected":""}><input type="radio" name="plan" value="quarterly" checked={plan==="quarterly"} onChange={()=>setPlan("quarterly")} disabled={Boolean(foundersIntentId)}/><span><b>باقة 3 + 1</b><small>{foundersIntentId?"سعر المؤسس مخصص للباقة الشهرية":"57 ر.س لأربعة أشهر"}</small></span></label>
    </div>
    {foundersIntentId?<p className="checkout-notice">تم تخصيص سعر مؤسس لحسابك. يظهر المبلغ النهائي داخل نموذج الدفع، ولا يمكن دمجه مع كود خصم آخر.</p>:<div className="checkout-code"><label htmlFor="discount-code">كود خصم (اختياري)</label><input id="discount-code" value={discountCode} onChange={event=>setDiscountCode(event.target.value.toUpperCase())} maxLength={32} placeholder="مثال: FOUNDERS100" autoCapitalize="characters"/></div>}
    <div className="checkout-methods" aria-label="طريقة الاشتراك"><span>الدفع المستضاف في سلة</span><span>التفعيل بعد مراجعة يدوية</span></div>
    <button className="checkout-start" disabled={busy} onClick={()=>void startSallaManualReview()}>{busy?"جارٍ التجهيز…":"الانتقال إلى اشتراك NAVIXA في سلة"}</button>
    <p className="checkout-notice">لا نطلب رقم طلب أو إيصالًا منك في NAVIXA. استخدم بريد NAVIXA نفسه في سلة، ثم عُد إلى حسابك وانتظر المراجعة.</p>{notice&&<p className="checkout-notice" role="status">{notice}</p>}
    <div ref={formRef} className="navixa-moyasar-form" aria-live="polite"/>
    <p className="checkout-footnote">تُعالج بيانات الدفع داخل سلة. لا تحفظ NAVIXA رقم البطاقة أو بيانات المحفظة، ولا يمنح طلب المراجعة استحقاقًا قبل اعتماد المدير.</p>
  </section>;
}
