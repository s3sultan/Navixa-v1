"use client";
import {useEffect,useState} from "react";
const phrases=[{text:"أستغفر الله",target:33},{text:"سبحان الله",target:33},{text:"الله أكبر",target:33},{text:"لا إله إلا الله",target:34}];

type FeedbackMode="both"|"sound"|"vibrate"|"silent";
export default function TasbihCounter({onComplete}:{onComplete?:()=>void}){
  const [index,setIndex]=useState(0);
  const [count,setCount]=useState(0);
  const [feedback,setFeedback]=useState<FeedbackMode>("both");
  const current=phrases[index];
  useEffect(()=>{const saved=localStorage.getItem("navixa-tasbih-feedback") as FeedbackMode|null;if(saved&&["both","sound","vibrate","silent"].includes(saved))setFeedback(saved)},[]);
  useEffect(()=>{localStorage.setItem("navixa-tasbih-feedback",feedback)},[feedback]);
  const playTick=(complete=false)=>{try{if(feedback==="sound"||feedback==="both"){const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;const ctx=new AudioCtx();const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type="sine";oscillator.frequency.value=complete?880:620;gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(complete?.16:.09,ctx.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+(complete?.24:.1));oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+(complete?.26:.12));setTimeout(()=>ctx.close(),complete?500:300)}if((feedback==="vibrate"||feedback==="both")&&"vibrate" in navigator)navigator.vibrate(complete?[30,45,70]:14)}catch{}}

  const tap=()=>{
    const next=count+1;const complete=next>=current.target;playTick(complete);
    if(complete){if(index===phrases.length-1)onComplete?.();setIndex(i=>(i+1)%phrases.length);setCount(0)}else setCount(next);
  };
  const reset=()=>{setIndex(0);setCount(0)};
  const progress=Math.round((count/current.target)*100);
  return <div className="tasbih-box">
    <div className="tasbih-current-label">الذكر الحالي</div>
    <button type="button" className="tasbih-tap" onClick={tap} aria-label={`تسبيح ${current.text} — ${count} من ${current.target}`}>
      <b>{current.text}</b>
      <span className="tasbih-count">{count}<small> / {current.target}</small></span>
      <i className="tasbih-progress"><i style={{width:`${progress}%`}}/></i>
      <em>اضغط للعدّ</em>
    </button>
    <div className="tasbih-dots" aria-label="مراحل التسبيح">{phrases.map((p,i)=><i key={p.text} className={i===index?"active":i<index?"done":""}/>)}</div>
    <div className="tasbih-step-text">{index+1} من {phrases.length} أذكار</div>
    <label className="tasbih-feedback"><span>تنبيه العدّ</span><select value={feedback} onChange={event=>setFeedback(event.target.value as FeedbackMode)}><option value="both">صوت واهتزاز</option><option value="sound">صوت فقط</option><option value="vibrate">اهتزاز فقط</option><option value="silent">صامت</option></select></label>
    <button type="button" className="tasbih-reset" onClick={reset}>إعادة البداية</button>
  </div>
}
