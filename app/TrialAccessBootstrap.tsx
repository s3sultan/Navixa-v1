"use client";

import {useEffect} from "react";
import {launchTrialPhase} from "./launchTrial";

export default function TrialAccessBootstrap(){
  useEffect(()=>{
    const sync=()=>{
      const phase=launchTrialPhase(new Date());
      const active=phase==="trial"||phase==="reminder";
      document.documentElement.dataset.navixaTrial=active?"active":"inactive";
      document.documentElement.dataset.navixaTrialPhase=phase;
      window.dispatchEvent(new CustomEvent("navixa-trial-access-changed",{detail:{active,phase}}));
    };
    sync();
    const id=window.setInterval(sync,30000);
    window.addEventListener("pageshow",sync);
    return()=>{window.clearInterval(id);window.removeEventListener("pageshow",sync)};
  },[]);
  return null;
}
