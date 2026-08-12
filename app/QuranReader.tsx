"use client";
import {useEffect,useRef,useState} from "react";

type QuranAyah={number:number;text:string;numberInSurah:number;surah:{name:string}};

const dayPage=()=>(Math.floor(Date.now()/86400000)%604)+1;

export default function QuranReader({wirdDone,onComplete}:{wirdDone:boolean;onComplete:()=>void}){
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [quranError,setQuranError]=useState("");
  const [marks,setMarks]=useState<number[]>([]);
  const [fontSize,setFontSize]=useState(16);
  const [lensOn,setLensOn]=useState(false);
  const [handMode,setHandMode]=useState(false);
  const [lensPos,setLensPos]=useState<{x:number;y:number}|null>(null);
  const [lensWidth,setLensWidth]=useState(0);
  const quranRef=useRef<HTMLDivElement>(null);
  const LENS=170;

  useEffect(()=>{
    const page=dayPage();
    fetch(`/api/quran-page?page=${page}`).then(r=>r.json()).then(d=>{if(d?.data?.ayahs)setQuranAyahs(d.data.ayahs);else setQuranError("تعذر تحميل صفحة اليوم")}).catch(()=>setQuranError("تعذر تحميل صفحة اليوم"));
    setMarks(JSON.parse(localStorage.getItem(`navixa-quran-marks-${page}`)||"[]"));
  },[]);

  const toggleMark=(num:number)=>{
    setMarks(prev=>{
      const next=prev.includes(num)?prev.filter(n=>n!==num):[...prev,num];
      localStorage.setItem(`navixa-quran-marks-${dayPage()}`,JSON.stringify(next));
      return next;
    });
  };
  const handleLensMove=(e:React.MouseEvent)=>{
    if(!lensOn||!quranRef.current)return;
    const rect=quranRef.current.getBoundingClientRect();
    setLensPos({x:e.clientX-rect.left,y:e.clientY-rect.top});
    setLensWidth(quranRef.current.clientWidth);
  };

  const groupedAyahs:{surah:string;ayahs:QuranAyah[]}[]=[];
  (quranAyahs||[]).forEach(ayah=>{
    const last=groupedAyahs[groupedAyahs.length-1];
    if(last&&last.surah===ayah.surah.name)last.ayahs.push(ayah);else groupedAyahs.push({surah:ayah.surah.name,ayahs:[ayah]});
  });
  const renderQuranContent=()=>groupedAyahs.map(group=><div key={group.surah}><small>سورة {group.surah}</small><p>{group.ayahs.map(a=><span key={a.number} className={marks.includes(a.number)?"marked":""} onClick={()=>toggleMark(a.number)}>{a.text} <em>﴿{a.numberInSurah}﴾</em> </span>)}</p></div>);

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم — صفحة {dayPage()}</small><h3>{groupedAyahs[0]?.surah||"جارٍ التحميل…"}</h3></div></header>
    <div className="quran-toolbar">
      <div className="zoom-group"><button type="button" onClick={()=>setFontSize(f=>Math.max(14,f-2))}>A-</button><span>{fontSize}</span><button type="button" onClick={()=>setFontSize(f=>Math.min(30,f+2))}>A+</button></div>
      <button type="button" className={lensOn?"tool-toggle on":"tool-toggle"} onClick={()=>setLensOn(v=>!v)}>🔍 عدسة القراءة</button>
      <button type="button" className={handMode?"tool-toggle on":"tool-toggle"} onClick={()=>setHandMode(v=>!v)}>✋ مؤشر اليد</button>
    </div>
    {quranError&&<p className="quran-error">{quranError}</p>}
    <div ref={quranRef} className={`quran-text${handMode?" hand-cursor":""}`} style={{fontSize}} onMouseMove={handleLensMove} onMouseLeave={()=>setLensPos(null)}>
      {renderQuranContent()}
      {lensOn&&lensPos&&<div className="quran-lens" style={{left:lensPos.x-LENS/2,top:lensPos.y-LENS/2,width:LENS,height:LENS}}>
        <div className="quran-lens-inner" style={{fontSize,width:lensWidth||undefined,transformOrigin:"0 0",transform:`translate(${LENS/2}px,${LENS/2}px) scale(2.3) translate(${-lensPos.x}px,${-lensPos.y}px)`}}>{renderQuranContent()}</div>
      </div>}
    </div>
    <p className="quran-hint">💡 اضغط على أي آية لتمييزها بخط تحتها أثناء القراءة.</p>
    {!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
  </article>;
}

export {dayPage};
