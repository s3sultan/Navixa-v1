"use client";
import {useMemo,useRef,useState} from "react";

type AzkarItem={ID:number;ARABIC_TEXT:string;REPEAT:number};

export default function AzkarList({items}:{items:AzkarItem[]}){
  const [lensOn,setLensOn]=useState(false);
  const [lensPos,setLensPos]=useState<{x:number;y:number}|null>(null);
  const [counts,setCounts]=useState<Record<number,number>>({});
  const listRef=useRef<HTMLDivElement>(null);
  const LENS=190;
  const normalized=useMemo(()=>items.map(item=>({...item,REPEAT:Math.max(1,Number(item.REPEAT)||1)})),[items]);
  const tap=(item:AzkarItem)=>setCounts(current=>({...current,[item.ID]:Math.min(item.REPEAT,(current[item.ID]||0)+1)}));
  const renderItems=(interactive=true)=>normalized.map(item=>{
    const count=counts[item.ID]||0,done=count>=item.REPEAT;
    return <button type="button" key={item.ID} className={`azkar-item${done?" is-done":""}`} onClick={interactive?()=>tap(item):undefined} tabIndex={interactive?0:-1} aria-label={item.REPEAT>1?`${item.ARABIC_TEXT}، ${count} من ${item.REPEAT}`:item.ARABIC_TEXT}>
      <span>{item.ARABIC_TEXT}</span>
      <em>{item.REPEAT>1?`اضغط بعد كل مرة · ${count} / ${item.REPEAT}`:done?"تم ✓":"اضغط عند القراءة"}</em>
    </button>;
  });
  const updateLens=(clientX:number,clientY:number)=>{
    if(!lensOn||!listRef.current)return;
    const rect=listRef.current.getBoundingClientRect();
    setLensPos({x:clientX-rect.left,y:clientY-rect.top});
  };
  return <>
    <div className="azkar-tools"><button type="button" className={lensOn?"tool-toggle on":"tool-toggle"} onClick={()=>{setLensOn(value=>!value);setLensPos(null)}}>🔍 {lensOn?"إيقاف العدسة":"عدسة مكبرة"}</button><small>اضغط على الذكر ليحسب لك التكرار تلقائيًا</small></div>
    <div ref={listRef} className={`azkar-list${lensOn?" lens-enabled":""}`} onMouseMove={e=>updateLens(e.clientX,e.clientY)} onMouseLeave={()=>setLensPos(null)} onTouchMove={e=>{const touch=e.touches[0];if(touch)updateLens(touch.clientX,touch.clientY)}}>{renderItems(true)}
      {lensOn&&lensPos&&<div className="azkar-lens" style={{left:lensPos.x-LENS/2,top:lensPos.y-LENS/2,width:LENS,height:LENS}}><div className="azkar-lens-inner" style={{transform:`translate(${LENS/2}px,${LENS/2}px) scale(1.7) translate(${-lensPos.x}px,${-lensPos.y}px)`}}>{renderItems(false)}</div></div>}
    </div>
  </>;
}
