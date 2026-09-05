"use client";

import {useEffect} from "react";

const PRICING_PATH="/pricing";

type ShortcutTarget={selector:string;className:string;slot:string};

const targets:ShortcutTarget[]=[
  {selector:'.topbar-actions a[href="/account"], .topbar-account[href="/account"]',className:"topbar-account topbar-pricing-shortcut",slot:"desktop"},
  {selector:'.mobile-hub-account[href="/account"], .mobile-hub-account',className:"mobile-hub-pricing-shortcut",slot:"mobile"},
];

function makePricingLink(className:string,slot:string){
  const link=document.createElement("a");
  link.href=PRICING_PATH;
  link.className=className;
  link.setAttribute("aria-label","فتح قائمة أسعار NAVIXA");
  link.dataset.navixaPricingShortcut="true";
  link.dataset.navixaPricingSlot=slot;
  link.innerHTML='<b aria-hidden="true">﷼</b><span>الأسعار</span>';
  return link;
}

export default function PricingHeaderShortcut(){
  useEffect(()=>{
    let raf=0;

    const ensureShortcuts=()=>{
      for(const target of targets){
        const account=document.querySelector(target.selector);
        if(!account||!account.parentElement)continue;

        const existing=document.querySelector(`[data-navixa-pricing-slot="${target.slot}"]`);
        if(existing){
          if(existing.previousElementSibling!==account)account.insertAdjacentElement("afterend",existing);
          continue;
        }

        account.insertAdjacentElement("afterend",makePricingLink(target.className,target.slot));
      }
    };

    const scheduleEnsure=()=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(ensureShortcuts);
    };

    ensureShortcuts();
    const observer=new MutationObserver(scheduleEnsure);
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("resize",scheduleEnsure,{passive:true});
    window.addEventListener("pageshow",scheduleEnsure);

    return()=>{
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize",scheduleEnsure);
      window.removeEventListener("pageshow",scheduleEnsure);
    };
  },[]);
  return null;
}
