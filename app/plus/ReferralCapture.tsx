"use client";

import {useEffect} from "react";

const valid=(value:string)=>/^NVX-[A-Z0-9]{8}$/.test(value);

export default function ReferralCapture(){
  useEffect(()=>{
    const code=new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase()||"";
    if(valid(code))localStorage.setItem("navixa_referral_code",code);
  },[]);
  return null;
}
