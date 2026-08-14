"use client";
import {useEffect,useState} from "react";
const CYCLE=1200,REST=30;
const steps=["انظر إلى نقطة بعيدة","ارمش ببطء 10 مرات","أرخِ كتفيك وخذ نفسًا هادئًا"];
export default function EyeRestClock(){
  const [elapsed,setElapsed]=useState(0),[resting,setResting]=useState(false),[restSeconds,setRestSeconds]=useState(REST),[restStep,setRestStep]=useState(0),[demo,setDemo]=useState(false);
  useEffect(()=>{const timer=window.setInterval(()=>{if(resting){setRestSeconds(s=>{if(s<=1){setResting(false);setRestStep(0);return REST}return s-1})}else setElapsed(e=>{const next=e+1;if(next>=CYCLE){setResting(true);setRestSeconds(REST);setRestStep(0);return 0}return next})},1000);return()=>window.clearInterval(timer)},[resting]);
  const angle=(elapsed/CYCLE)*360, skip=()=>{setResting(false);setElapsed(0);setRestSeconds(REST);setRestStep(0)}, minutesLeft=Math.ceil((CYCLE-elapsed)/60);
  return <article className="eye-rest-card">
    <header><span className="eye-rest-icon">👁</span><div><small>عناية بصرية واقعية</small><h3>استراحة العين 20 · 20 · 20</h3></div><span className="eye-live-dot"/></header>
    <div className="clock-face"><div className="eye-focus-dot"/>{Array.from({length:12}).map((_,i)=><i key={i} style={{transform:`rotate(${i*30}deg)`}}/>)}<b className="clock-hand" style={{transform:`rotate(${angle}deg)`}}/><span className="clock-center"/></div>
    <p>{resting?`الخطوة ${restStep+1} من ${steps.length}`:`استراحة تلقائية بعد ${minutesLeft} د`}</p>
    <div className="eye-routine"><span>20 دقيقة شاشة</span><b>→</b><span>20 ثانية راحة</span><b>→</b><span>20 قدمًا بُعدًا</span></div><button className="routine-demo-button" type="button" onClick={()=>setDemo(true)}>تجربة سريعة: كيف تعمل؟</button>
    {resting&&<div className="eye-rest-overlay"><div className="rest-ring"><b>{restSeconds}</b></div><strong>{steps[restStep]}</strong><p>أبعد نظرك عن الشاشة ودع عينيك تسترخيان.</p><div className="eye-rest-actions"><button type="button" onClick={()=>setRestStep(s=>Math.min(steps.length-1,s+1))}>{restStep<steps.length-1?"الخطوة التالية":"إنهاء الراحة"}</button><button type="button" onClick={skip}>تخطي</button></div></div>}{demo&&<div className="eye-demo-overlay"><div className="demo-demo-icon">👁</div><small>تجربة توضيحية · 20 ثانية</small><h4>أبعد عينيك عن الشاشة</h4><p>انظر إلى جسم بعيد، ارمش بهدوء، وأرخِ الكتفين. هذه التجربة لا تغيّر مؤقتك الحقيقي.</p><div className="demo-steps"><span>1<br/><b>انظر بعيدًا</b></span><span>2<br/><b>ارمش 10 مرات</b></span><span>3<br/><b>تنفّس</b></span></div><button type="button" onClick={()=>setDemo(false)}>فهمت الفكرة</button></div>}
  </article>
}
