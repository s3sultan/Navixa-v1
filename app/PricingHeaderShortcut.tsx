"use client";

import {useEffect} from "react";

const PRICING_PATH="/pricing";

function makePricingLink(className:string){
  const link=document.createElement("a");
  link.href=PRICING_PATH;
  link.className=className;
  link.setAttribute("aria-label","فتح قائمة أسعار NAVIXA");
  link.dataset.navixaPricingShortcut="true";
  link.innerHTML='<b aria-hidden="true">﷼</b><span>الأسعار</span>';
  return link;
}

export default function PricingHeaderShortcut(){
  useEffect(()=>{
    const inserted:HTMLElement[]=[];
    const attach=(account:Element|null,className:string)=>{
      if(!account||account.parentElement?.querySelector('[data-navixa-pricing-shortcut="true"]'))return;
      const link=makePricingLink(className);
      account.insertAdjacentElement("afterend",link);
      inserted.push(link);
    };

    attach(document.querySelector('.topbar-actions a[href="/account"]'),"topbar-account topbar-pricing-shortcut");
    attach(document.querySelector('.mobile-hub-account[href="/account"]'),"mobile-hub-pricing-shortcut");

    return()=>inserted.forEach(item=>item.remove());
  },[]);
  return null;
}
