"use client";
import {useEffect,useState} from "react";
const CYCLE=1200;

export default function EyeRestClock(){
  const [elapsed,setElapsed]=useState(0);
  const [resting,setResting]=useState(false);
  const [restSeconds,setRestSeconds]=useState(20);

  useEffect(()=>{
    const timer=setInterval(()=>{
      if(resting){
        setRestSeconds(s=>{if(s<=1){setResting(false);return 20}return s-1});
      }else{
        setElapsed(e=>{const next=e+1;if(next>=CYCLE){setResting(true);setRestSeconds(20);return 0}return next});
      }
    },1000);
    return()=>clearInterval(timer);
  },[resting]);

  const angle=(elapsed/CYCLE)*360;
  const skip=()=>{setResting(false);setElapsed(0)};
  const minutesLeft=Math.ceil((CYCLE-elapsed)/60);

  return <article className="eye-rest-card">
    <header><span className="eye-rest-icon">👁</span><div><small>قاعدة 20-20-20</small><h3>راحة عينيك وظهرك</h3></div></header>
    <div className="clock-face">
      {Array.from({length:12}).map((_,i)=><i key={i} style={{transform:`rotate(${i*30}deg)`}}/>)}
      <b className="clock-hand" style={{transform:`rotate(${angle}deg)`}}/>
      <span className="clock-center"/>
    </div>
    <p>{resting?"حان وقت الراحة":`باقي ${minutesLeft} د لراحة عينيك القادمة`}</p>
    {resting&&<div className="eye-rest-overlay"><div className="rest-ring"><b>{restSeconds}</b></div><p>👀 انظر لشيء يبعد 20 قدمًا الآن</p><button type="button" onClick={skip}>تخطي</button></div>}
  </article>
}
