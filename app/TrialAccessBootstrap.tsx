"use client";

import {useEffect} from "react";

export default function TrialAccessBootstrap(){
  useEffect(()=>{
    let live=true;
    const sync=()=>fetch("/api/access/trial",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?r.json():null).then(data=>{
      if(!live||!data)return;
      document.documentElement.dataset.navixaTrial=data.active?"active":"inactive";
      document.documentElement.dataset.navixaTrialPhase=data.phase;
      window.dispatchEvent(new CustomEvent("navixa-trial-access-changed",{detail:{active:data.active,phase:data.phase}}));
    }).catch(()=>{});
    sync();const id=window.setInterval(sync,30000);window.addEventListener("pageshow",sync);
    return()=>{live=false;window.clearInterval(id);window.removeEventListener("pageshow",sync)};
  },[]);
  return null;
}
