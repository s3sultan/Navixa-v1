"use client";
import {useEffect,useRef,useState} from "react";

type QuranAyah={number:number;text:string;numberInSurah:number;surah:{name:string};juz?:number;hizbQuarter?:number};

const todayKey=()=>new Date().toISOString().slice(0,10);
const dayPage=()=>typeof window==="undefined"?1:Number(localStorage.getItem("navixa-quran-current-page")||1);

export default function QuranReader({wirdDone,onComplete}:{wirdDone:boolean;onComplete:()=>void}){
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [page,setPage]=useState(1);
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
    const savedPage=Math.min(604,Math.max(1,Number(localStorage.getItem("navixa-quran-current-page")||1)));
    const savedDate=localStorage.getItem("navixa-quran-last-date");
    const nextPage=savedDate&&savedDate!==todayKey()?Math.min(604,savedPage+1):savedPage;
    localStorage.setItem("navixa-quran-current-page",String(nextPage));
    localStorage.setItem("navixa-quran-last-date",todayKey());
    setPage(nextPage);
    const timer=setInterval(()=>{const last=localStorage.getItem("navixa-quran-last-date");if(last&&last!==todayKey()){const current=Math.min(604,Number(localStorage.getItem("navixa-quran-current-page")||1)+1);localStorage.setItem("navixa-quran-current-page",String(current));localStorage.setItem("navixa-quran-last-date",todayKey());setPage(current)}},60000);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{if(!page)return;setQuranAyahs(null);setQuranError("");fetch(`/api/quran-page?page=${page}`).then(r=>r.json()).then(d=>{if(d?.data?.ayahs)setQuranAyahs(d.data.ayahs);else setQuranError("تعذر تحميل صفحة اليوم")}).catch(()=>setQuranError("تعذر تحميل صفحة اليوم"));setMarks(JSON.parse(localStorage.getItem(`navixa-quran-marks-${page}`)||"[]"))},[page]);

  const toggleMark=(num:number)=>{
    setMarks(prev=>{
      const next=prev.includes(num)?prev.filter(n=>n!==num):[...prev,num];
      localStorage.setItem(`navixa-quran-marks-${page}`,JSON.stringify(next));
      return next;
    });
  };
  const handleLensMove=(e:React.MouseEvent)=>{
    if(!lensOn||!quranRef.current)return;
    const rect=quranRef.current.getBoundingClientRect();
    setLensPos({x:e.clientX-rect.left,y:e.clientY-rect.top});
    setLensWidth(quranRef.current.clientWidth);
  };

  const firstAyah=quranAyahs?.[0];
  const currentJuz=firstAyah?.juz;
  const currentHizb=firstAyah?.hizbQuarter?Math.ceil(firstAyah.hizbQuarter/4):undefined;
  const groupedAyahs:{surah:string;ayahs:QuranAyah[]}[]=[];
  (quranAyahs||[]).forEach(ayah=>{
    const last=groupedAyahs[groupedAyahs.length-1];
    if(last&&last.surah===ayah.surah.name)last.ayahs.push(ayah);else groupedAyahs.push({surah:ayah.surah.name,ayahs:[ayah]});
  });
  const renderQuranContent=()=>groupedAyahs.map(group=><div key={group.surah}><small>سورة {group.surah}</small><p>{group.ayahs.map(a=><span key={a.number} className={marks.includes(a.number)?"marked":""} onClick={()=>toggleMark(a.number)}>{a.text} <em>﴿{a.numberInSurah}﴾</em> </span>)}</p></div>);

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم — صفحة {page} من 604</small><h3>{groupedAyahs[0]?.surah||"جارٍ التحميل…"}</h3><div className="quran-meta"><span>السورة: {groupedAyahs[0]?.surah||"—"}</span><span>الجزء: {currentJuz||"—"}</span><span>الحزب: {currentHizb||"—"}</span></div></div></header>
    <img className="quran-page-image" src={`https://quran.islam-db.com/data/pages/quranpages_1024/images/page${String(page).padStart(3,"0")}.png`} alt={`صفحة المصحف رقم ${page}`} loading="eager" />
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
    <a className="quran-full-link" href="https://qurancomplex.gov.sa/quran-hafs/" target="_blank" rel="noreferrer">فتح المصحف الكامل بالرسم الحفصي ↗</a>
    {!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
  </article>;
}

export {dayPage};
