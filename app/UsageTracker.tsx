"use client";
import { useEffect } from "react";

const labels: Record<string,string>={"/":"الرئيسية","/today":"يومي","/worship":"الورد","/health":"الصحة","/meetings":"الاجتماعات"};
function send(payload: Record<string,unknown>) { const data=JSON.stringify(payload); if(navigator.sendBeacon) navigator.sendBeacon("/api/usage/event",new Blob([data],{type:"application/json"})); else void fetch("/api/usage/event",{method:"POST",headers:{"content-type":"application/json"},body:data,keepalive:true,credentials:"same-origin"}); }

export default function UsageTracker(){useEffect(()=>{const path=window.location.pathname;if(!labels[path])return;const started=Date.now();let tapped=false;send({path,event:"view"});const tap=(event:PointerEvent)=>{if(tapped)return;tapped=true;send({path,event:"tap",x:Math.min(7,Math.floor(event.clientX/window.innerWidth*8)),y:Math.min(11,Math.floor(event.clientY/window.innerHeight*12))})};const leave=()=>{const seconds=Math.min(3600,Math.floor((Date.now()-started)/1000));if(seconds>0)send({path,event:"engagement",durationSeconds:seconds})};window.addEventListener("pointerdown",tap,{passive:true});window.addEventListener("pagehide",leave,{once:true});return()=>{window.removeEventListener("pointerdown",tap);window.removeEventListener("pagehide",leave);leave()};},[]);return null;}
