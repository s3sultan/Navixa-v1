"use client";
import {useEffect,useState} from "react";
const phases=[{key:"inhale",label:"شهيق",seconds:5},{key:"hold",label:"حبس النفس",seconds:4},{key:"exhale",label:"زفير",seconds:5}] as const;
const ROUND_CYCLE=5;
const mix=(t:number)=>{const a=[7,94,61],b=[141,120,207];const rgb=a.map((c,i)=>Math.round(c+(b[i]-c)*t));return `rgb(${rgb.join(",")})`};

export default function BreathingExercise(){
  const [running,setRunning]=useState(false);
  const [phaseIndex,setPhaseIndex]=useState(0);
  const [secondsLeft,setSecondsLeft]=useState<number>(phases[0].seconds);
  const [rounds,setRounds]=useState(0);

  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(()=>setSecondsLeft(s=>s-1),1000);
    return()=>clearInterval(timer);
  },[running]);

  useEffect(()=>{
    if(!running||secondsLeft>0)return;
    const nextIndex=(phaseIndex+1)%phases.length;
    if(nextIndex===0)setRounds(r=>r+1);
    setPhaseIndex(nextIndex);
    setSecondsLeft(phases[nextIndex].seconds);
  },[secondsLeft,running,phaseIndex]);

  const toggle=()=>{
    if(running){setRunning(false);return}
    setRunning(true);setPhaseIndex(0);setSecondsLeft(phases[0].seconds);
  };

  const phase=phases[phaseIndex];
  const progress=1-(secondsLeft/phase.seconds);
  const scale=phase.key==="inhale"?1+progress*.35:phase.key==="exhale"?1.35-progress*.35:1.35;
  const color=mix((rounds%ROUND_CYCLE)/ROUND_CYCLE);

  return <article className="breathing-card">
    <header><span className="breathing-icon">🫁</span><div><small>تمرين تنفس</small><h3>شهيق · حبس · زفير</h3></div></header>
    <div className="breathing-circle" style={{transform:`scale(${running?scale:1})`,background:running?color:"#075e3d"}}>
      <b>{running?phase.label:"ابدأ"}</b>
      {running&&<span>{secondsLeft}</span>}
    </div>
    <p>{running?`الجولة ${rounds+1}`:"شهيق 5ث، حبس 4ث، زفير 5ث"}</p>
    <button type="button" onClick={toggle}>{running?"إيقاف":"ابدأ التمرين"}</button>
  </article>
}
