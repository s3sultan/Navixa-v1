"use client";
import {useState} from "react";
const phrases=[{text:"أستغفر الله",target:33},{text:"سبحان الله",target:33},{text:"الله أكبر",target:33},{text:"لا إله إلا الله",target:34}];

export default function TasbihCounter({onComplete}:{onComplete?:()=>void}){
  const [index,setIndex]=useState(0);
  const [count,setCount]=useState(0);
  const current=phrases[index];
  const tap=()=>{
    const next=count+1;
    if(next>=current.target){if(index===phrases.length-1)onComplete?.();setIndex(i=>(i+1)%phrases.length);setCount(0)}else setCount(next);
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
    <button type="button" className="tasbih-reset" onClick={reset}>إعادة البداية</button>
  </div>
}
