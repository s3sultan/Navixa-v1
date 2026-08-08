"use client";
import {useEffect,useState} from "react";
const phrases=["أستغفر الله","سبحان الله","الحمد لله","الله أكبر","لا إله إلا الله"];

export default function FocusTasbihNudge({running}:{running:boolean}){
  const [index,setIndex]=useState(0);
  const [dismissed,setDismissed]=useState(false);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setIndex(i=>(i+1)%phrases.length),4000);return()=>clearInterval(timer)},[running]);
  useEffect(()=>{if(running)setDismissed(false)},[running]);
  if(!running||dismissed)return null;
  return <div className="focus-tasbih-nudge"><span>{phrases[index]}</span><button type="button" aria-label="إغلاق" onClick={()=>setDismissed(true)}>×</button></div>
}
