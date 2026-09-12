"use client";

import {useEffect} from "react";
import {readAdjustments} from "./prayerTimeModel";
import {readSharedPrayerLocation,subscribePrayerLocation,type SharedPrayerLocation} from "./prayerLocationModel";

async function syncLocation(location:SharedPrayerLocation){
  const body=location.mode==="city"
    ?{mode:"city",city:location.city,country:location.country,label:location.label,adjustments:readAdjustments()}
    :{mode:"coords",lat:location.lat,lng:location.lng,label:location.label,adjustments:readAdjustments()};
  await fetch("/api/prayer-alerts/settings",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)}).catch(()=>null);
}

export default function PrayerPushSync(){
  useEffect(()=>{
    const saved=readSharedPrayerLocation();
    if(saved)void syncLocation(saved);
    return subscribePrayerLocation(location=>void syncLocation(location));
  },[]);
  return null;
}
