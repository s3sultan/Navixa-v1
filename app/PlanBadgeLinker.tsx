"use client";

import {useEffect} from "react";

const upgradeBadge=(badge:Element)=>{
  if(!(badge instanceof HTMLElement)||badge.dataset.planLinks==="ready")return;
  badge.dataset.planLinks="ready";
  badge.textContent="";
  badge.classList.add("plan-access-badge");
  const label=document.createElement("span");
  label.className="plan-access-label";
  label.textContent="متاح في";
  const azm=document.createElement("a");
  azm.href="/sprint";
  azm.className="plan-access-link azm";
  azm.textContent="عَزْم";
  azm.setAttribute("aria-label","عرض تفاصيل باقة عَزْم");
  const himma=document.createElement("a");
  himma.href="/plus";
  himma.className="plan-access-link himma";
  himma.textContent="هِمّة";
  himma.setAttribute("aria-label","عرض تفاصيل باقة هِمّة");
  badge.append(label,azm,himma);
};

export default function PlanBadgeLinker(){
  useEffect(()=>{
    if(window.location.pathname!=="/")return;
    const scan=()=>document.querySelectorAll(".plus-badge").forEach(upgradeBadge);
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
