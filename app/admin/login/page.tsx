"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import "./login.css";

const GOOGLE_CLIENT_ID="876266145464-51o36n0s7jkgrtd0vhqh2cai1koo05r6.apps.googleusercontent.com";
type GoogleIdentity={accounts:{id:{initialize:(options:{client_id:string;callback:(result:{credential:string})=>void})=>void;renderButton:(element:HTMLElement,options:Record<string,string|number>)=>void}}};

export default function AdminLogin(){
  const googleButton=useRef<HTMLDivElement>(null);
  const swipeTrack=useRef<HTMLDivElement>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [swipe,setSwipe]=useState(0);
  const [unlocked,setUnlocked]=useState(false);

  const moveSwipe=(clientX:number)=>{
    const track=swipeTrack.current;if(!track||unlocked)return;
    const rect=track.getBoundingClientRect();
    const progress=Math.max(0,Math.min(1,(rect.right-clientX)/(rect.width-58)));
    setSwipe(progress);
    if(progress>.92){setUnlocked(true);setSwipe(1)}
  };

  useEffect(()=>{
    const render=()=>{
      const google=(window as Window&{google?:GoogleIdentity}).google;
      if(!google||!googleButton.current)return;
      google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:async({credential}:{credential:string})=>{
        setLoading(true);setError("");
        try{
          const response=await fetch("/api/auth/google",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential})});
          const data=await response.json();
          if(!response.ok){setError(data.error||"تعذر تسجيل الدخول بهذا الحساب");setLoading(false);return}
          window.location.href="/admin";
        }catch{setError("تعذر الاتصال بخدمة تسجيل الدخول");setLoading(false)}
      }});
      google.accounts.id.renderButton(googleButton.current,{type:"standard",theme:"outline",size:"large",text:"continue_with",shape:"rectangular",logo_alignment:"left",width:360,locale:"ar"});
      setLoading(false);
    };
    if((window as Window&{google?:GoogleIdentity}).google){render();return}
    const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.onload=render;script.onerror=()=>{setError("تعذر تحميل تسجيل الدخول من Google");setLoading(false)};document.head.appendChild(script);
  },[]);

  return <main className="login-page" dir="rtl"><section className="login-card"><Link href="/" className="login-brand"><span className="login-logo-mark"><img src="/navixa-mark.png" alt="" /></span><div><b>NAVIXA</b><small>ADMIN CENTER</small></div></Link><div className="login-title"><small>دخول الإدارة الآمن</small><h1>مرحبًا بعودتك</h1><p>اسحب شعار NAVIXA من اليمين إلى اليسار، ثم اختر حساب الإدارة المعتمد.</p></div><div ref={swipeTrack} className={`swipe-login ${unlocked?"unlocked":""}`} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveSwipe(e.clientX)}} onPointerUp={e=>{e.currentTarget.releasePointerCapture(e.pointerId);if(!unlocked)setSwipe(0)}} onPointerCancel={()=>!unlocked&&setSwipe(0)}><span>{unlocked?"تم التحقق — اختر حسابك":"اسحب للدخول"}</span><button aria-label="اسحب شعار NAVIXA للدخول" style={{right:`calc(5px + ${swipe*100}% - ${swipe*62}px)`}} onPointerDown={e=>{e.preventDefault();e.currentTarget.parentElement?.setPointerCapture(e.pointerId)}}><i/><i/></button></div><div className={`google-login-box ${unlocked?"shown":""}`}><div ref={googleButton}/>{loading&&unlocked&&<span>جارٍ تجهيز تسجيل الدخول…</span>}</div>{error&&<p className="login-error">{error}</p>}<p className="allowed-email">الحساب المسموح: <b>s2shug@gmail.com</b></p><p className="privacy">🔒 NAVIXA لا يرى كلمة مرور Google ولا يحفظها.</p></section><aside><span>✦</span><h2>إدارة NAVIXA<br/>بوضوح وثقة.</h2><p>اسحب للدخول، ثم دع Google تؤكد الحساب قبل فتح لوحة الإدارة.</p></aside></main>
}
