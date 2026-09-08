"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "./class-schedule-shortcut.css";

const SultanClassPilot=dynamic(()=>import("./SultanClassPilot"),{ssr:false});

type PilotResponse={enabled?:boolean};

export default function ClassScheduleShortcut(){
  const [allowed,setAllowed]=useState(false);const [open,setOpen]=useState(false);
  useEffect(()=>{let live=true;fetch("/api/pilots/class-schedule",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?await r.json() as PilotResponse:null).then(data=>{if(live)setAllowed(Boolean(data?.enabled))}).catch(()=>{if(live)setAllowed(false)});return()=>{live=false}},[]);
  if(!allowed)return null;
  return <div className="nx-schedule-shortcut-wrap">
    <button type="button" className="nx-schedule-shortcut" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="nx-private-schedule">
      <span className="nx-schedule-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 2v3M17 2v3M4 9h16M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 13h3v3H8z"/></svg></span>
      <span><b>جدولي</b><small>المحاضرات والتنبيهات</small></span><i aria-hidden="true">{open?"⌃":"⌄"}</i>
    </button>
    {open&&<div id="nx-private-schedule" className="nx-private-schedule"><SultanClassPilot/></div>}
  </div>;
}
