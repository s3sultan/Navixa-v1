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
  return <div className="tasbih-box">
    <button type="button" className="tasbih-tap" onClick={tap}>
      <b>{current.text}</b>
      <span>{count}/{current.target}</span>
    </button>
    <div className="tasbih-dots">{phrases.map((p,i)=><i key={p.text} className={i===index?"active":i<index?"done":""}/>)}</div>
    <button type="button" className="tasbih-reset" onClick={reset}>إعادة</button>
  </div>
}
