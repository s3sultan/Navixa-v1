"use client";
import {useRef,useState} from "react";

type AzkarItem={ID:number;ARABIC_TEXT:string;REPEAT:number};

export default function AzkarList({items}:{items:AzkarItem[]}){
  const [lensOn,setLensOn]=useState(false);
  const [lensPos,setLensPos]=useState<{x:number;y:number}|null>(null);
  const listRef=useRef<HTMLDivElement>(null);
  const LENS=180;
  const content=()=>items.map(item=><p key={item.ID}>{item.ARABIC_TEXT}{item.REPEAT>1&&<em> — تُقال {item.REPEAT} مرات</em>}</p>);
  const handleMove=(event:React.MouseEvent<HTMLDivElement>)=>{
    if(!lensOn||!listRef.current)return;
    const rect=listRef.current.getBoundingClientRect();
    setLensPos({x:event.clientX-rect.left,y:event.clientY-rect.top});
  };
  return <>
    <div className="azkar-tools"><button type="button" className={lensOn?"tool-toggle on":"tool-toggle"} onClick={()=>{setLensOn(value=>!value);setLensPos(null)}}>🔍 {lensOn?"إيقاف العدسة":"عدسة مكبرة"}</button></div>
    <div ref={listRef} className={`azkar-list${lensOn?" lens-enabled":""}`} onMouseMove={handleMove} onMouseLeave={()=>setLensPos(null)}>{content()}
      {lensOn&&lensPos&&<div className="azkar-lens" style={{left:lensPos.x-LENS/2,top:lensPos.y-LENS/2,width:LENS,height:LENS}}><div className="azkar-lens-inner" style={{transform:`translate(${LENS/2}px,${LENS/2}px) scale(1.55) translate(${-lensPos.x}px,${-lensPos.y}px)`}}>{content()}</div></div>}
    </div>
  </>;
}
