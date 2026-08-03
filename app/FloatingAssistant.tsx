"use client";

import {FormEvent, PointerEvent, useEffect, useRef, useState} from "react";
import "./floating-assistant.css";

type Message={from:"user"|"navixa";text:string};
export default function FloatingAssistant({onAddTask}:{onAddTask:(title:string)=>void}){
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState<Message[]>([{from:"navixa",text:"أنا معك؛ فضفض، اسأل، أو قل لي مهمة أنفذها لك."}]);
  const [pos,setPos]=useState({x:24,y:0});
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  useEffect(()=>setPos(p=>({...p,y:Math.max(90,innerHeight-108)})),[]);
  const pointerDown=(e:PointerEvent<HTMLButtonElement>)=>{drag.current={x:e.clientX,y:e.clientY,left:pos.x,top:pos.y};e.currentTarget.setPointerCapture(e.pointerId)};
  const pointerMove=(e:PointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;setPos({x:Math.max(10,Math.min(innerWidth-76,drag.current.left+e.clientX-drag.current.x)),y:Math.max(72,Math.min(innerHeight-76,drag.current.top+e.clientY-drag.current.y))})};
  const send=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;const input=form.elements.namedItem("message") as HTMLInputElement;const text=input.value.trim();if(!text)return;input.value="";setMessages(m=>[...m,{from:"user",text}]);const taskWords=["مهمة","ذكرني","لازم","أضف","سوي","سوّي"];
    if(taskWords.some(w=>text.includes(w))){const title=text.replace(/^(أضف|ضيف|ذكرني|مهمة|سوّي|سوي)\s*/," ").trim();onAddTask(title||text);setTimeout(()=>setMessages(m=>[...m,{from:"navixa",text:`تم، أضفتها لمهامك: ${title||text}`}]),300)}
    else if(/[تعب|ضغط|متضايق|زعلان|طفشت|فضفض]/.test(text))setTimeout(()=>setMessages(m=>[...m,{from:"navixa",text:"أفهمك. خذ راحتك بالكلام—وش أكثر شيء ضاغط عليك الآن؟ وبعدها نرتّب خطوة صغيرة بدون ضغط."}]),300);
    else setTimeout(()=>setMessages(m=>[...m,{from:"navixa",text:"وصلت فكرتك. نقدر نحوّلها لخطة أو مهمة واضحة—وش النتيجة التي تبيها أولًا؟"}]),300)
  };
  return <div className="floating-assistant" style={{left:pos.x,top:pos.y}} dir="rtl">
    {open&&<section className="assistant-panel"><header><div><i>✦</i><span><b>NAVIXA</b><small>سوالف وتنفيذ</small></span></div><button onClick={()=>setOpen(false)}>×</button></header><div className="assistant-chat">{messages.slice(-8).map((m,i)=><p key={i} className={m.from}>{m.text}</p>)}</div><div className="assistant-chips"><button onClick={()=>setMessages(m=>[...m,{from:"user",text:"أحتاج أفضفض"},{from:"navixa",text:"أنا حاضر. احكِ لي وش صار معك؟"}])}>فضفضة</button><button onClick={()=>setMessages(m=>[...m,{from:"navixa",text:"اكتب: أضف مهمة، ثم اكتب المطلوب."}])}>إضافة مهمة</button></div><form onSubmit={send}><input name="message" aria-label="رسالتك إلى NAVIXA" placeholder="اكتب براحتك أو اطلب مهمة..."/><button>↑</button></form></section>}
    <button className="assistant-bubble" aria-label="فتح مساعد NAVIXA" onClick={()=>setOpen(v=>!v)} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>drag.current=null}><span className="mini-mark"><i/><i/></span><em>متاح</em></button>
  </div>
}
