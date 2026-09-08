"use client";

import {useEffect,useRef} from "react";
import {readAdjustments} from "./prayerTimeModel";
import {readSharedPrayerLocation,subscribePrayerLocation} from "./prayerLocationModel";

function readIqama(){try{const value=JSON.parse(localStorage.getItem("navixa-iqama-manual")||"{}");return value&&typeof value==="object"?value:{}}catch{return {}}}

export default function PrayerAlertSync(){
  const lastRef=useRef("");
  useEffect(()=>{
    let active=true;
    const sync=async()=>{
      const location=readSharedPrayerLocation();if(!location)return;
      const payload=JSON.stringify({location,adjustments:readAdjustments(),iqama:readIqama()});
      if(payload===lastRef.current)return;
      try{const response=await fetch("/api/account/prayer-alert-settings",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:payload});if(active&&response.ok)lastRef.current=payload}catch{}
    };
    void sync();
    const unsubscribe=subscribePrayerLocation(()=>void sync());
    const timer=window.setInterval(()=>void sync(),30000);
    const onStorage=(event:StorageEvent)=>{if(event.key==="navixa-iqama-manual"||event.key==="navixa-prayer-adjustments")void sync()};
    window.addEventListener("storage",onStorage);
    return()=>{active=false;unsubscribe();window.clearInterval(timer);window.removeEventListener("storage",onStorage)};
  },[]);
  return null;
}
