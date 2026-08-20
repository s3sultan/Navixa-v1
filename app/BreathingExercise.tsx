"use client";
import {useEffect,useState} from "react";
const phases=[{key:"inhale",label:"شهيق",hint:"اسحب الهواء من الأنف بهدوء",seconds:5},{key:"hold",label:"ثبات",hint:"اثبت بدون شدّ أو ضغط",seconds:4},{key:"exhale",label:"زفير",hint:"أخرج الهواء ببطء من الفم",seconds:5}] as const;
const mix=(t:number)=>{const a=[7,94,61],b=[141,120,207];const rgb=a.map((c,i)=>Math.round(c+(b[i]-c)*t));return `rgb(${rgb.join(",")})`};

export default function BreathingExercise(){
  const [running,setRunning]=useState(false),[phaseIndex,setPhaseIndex]=useState(0),[secondsLeft,setSecondsLeft]=useState(phases[0].seconds),[rounds,setRounds]=useState(0);
  useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setSecondsLeft(s=>s-1),1000);return()=>window.clearInterval(timer)},[running]);
  useEffect(()=>{if(!running||secondsLeft>0)return;const next=(phaseIndex+1)%phases.length;if(next===0)setRounds(r=>r+1);setPhaseIndex(next);setSecondsLeft(phases[next].seconds)},[secondsLeft,running,phaseIndex]);
  const toggle=()=>{if(running){setRunning(false);return}setRunning(true);setPhaseIndex(0);setSecondsLeft(phases[0].seconds)};
  const reset=()=>{setRunning(false);setPhaseIndex(0);setSecondsLeft(phases[0].seconds);setRounds(0)};
  const phase=phases[phaseIndex], progress=1-(secondsLeft/phase.seconds), scale=phase.key==="inhale"?1+progress*.18:phase.key==="exhale"?1.18-progress*.18:1.18, color=mix((rounds%5)/5);
  return <article className="breathing-card">
    <header><span className="breathing-icon">🫁</span><div><small>تنفّس ببطء</small><h3>دورة تنفّس واقعية</h3></div><span className="breathing-status">{running?"جلسة نشطة":"جاهز"}</span></header>
    <figure className={`breathing-visual ${running?"active":""} ${phase.key}`}><img src="/health-guides/breathing.webp" alt="رجل يجلس بهدوء ويتنفس بصورة طبيعية"/><span className="breathing-halo" style={{transform:`scale(${running?scale:1})`,borderColor:running?color:"#087f83"}}/><figcaption><b>{running?phase.label:"استعد"}</b>{running&&<span>{secondsLeft}</span>}</figcaption></figure>
    <p className="breathing-hint">{running?phase.hint:"ضع كتفيك مرتاحين، واجعل الزفير أطول من الشهيق قدر الإمكان."}</p>
    <div className="breathing-meta"><span>النمط <b>5 · 4 · 5</b></span><span>الجولة <b>{rounds+1}</b></span></div>
    <div className="breathing-actions"><button type="button" onClick={toggle}>{running?"إيقاف مؤقت":"ابدأ الجلسة"}</button><button className="breathing-reset" type="button" onClick={reset}>إعادة</button></div>
  </article>
}
