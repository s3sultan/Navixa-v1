"use client";

import {useEffect,useRef,useState} from "react";
import "./login.css";

const GOOGLE_CLIENT_ID="70980940285-9mr2v4h5qqpgf40mfv2la65ir2kjhlpk.apps.googleusercontent.com";

export default function AdminLogin(){
  const googleButton=useRef<HTMLDivElement>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const render=()=>{
      const google=(window as any).google;
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
    if((window as any).google){render();return}
    const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.onload=render;script.onerror=()=>{setError("تعذر تحميل تسجيل الدخول من Google");setLoading(false)};document.head.appendChild(script);
  },[]);

  return <main className="login-page" dir="rtl"><section className="login-card"><a href="/" className="login-brand"><span>ن</span><div><b>NAVIXA</b><small>ADMIN CENTER</small></div></a><div className="login-title"><small>دخول الإدارة الآمن</small><h1>اختر حساب Google</h1><p>ستفتح لوحة الإدارة فقط عندما تؤكد Google أن البريد المختار هو بريد الإدارة الرسمي.</p></div><div className="google-login-box"><div ref={googleButton}/>{loading&&<span>جارٍ تجهيز تسجيل الدخول…</span>}</div>{error&&<p className="login-error">{error}</p>}<p className="allowed-email">الحساب المسموح: <b>s2shug@gmail.com</b></p><p className="privacy">🔒 NAVIXA لا يرى كلمة مرور Google ولا يحفظها.</p></section><aside><span>✦</span><h2>إدارة NAVIXA<br/>بوضوح وثقة.</h2><p>اختر حسابك بنفسك، وGoogle تؤكد البريد قبل فتح لوحة الإدارة.</p></aside></main>
}

