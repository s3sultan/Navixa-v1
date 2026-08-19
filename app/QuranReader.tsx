"use client";
import {useEffect,useState} from "react";

type QuranAyah={number:number;numberInSurah:number;surah:{name:string};juz?:number;hizbQuarter?:number};

const todayKey=()=>new Date().toISOString().slice(0,10);
const dayPage=()=>typeof window==="undefined"?1:Number(localStorage.getItem("navixa-quran-current-page")||1);

export default function QuranReader({wirdDone,onComplete}:{wirdDone:boolean;onComplete:()=>void}){
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [page,setPage]=useState(1);
  const [quranError,setQuranError]=useState("");
  const [isSpeaking,setIsSpeaking]=useState(false);

  useEffect(()=>{
    const savedPage=Math.min(604,Math.max(1,Number(localStorage.getItem("navixa-quran-current-page")||1)));
    const savedDate=localStorage.getItem("navixa-quran-last-date");
    const nextPage=savedDate&&savedDate!==todayKey()?Math.min(604,savedPage+1):savedPage;
    localStorage.setItem("navixa-quran-current-page",String(nextPage));
    localStorage.setItem("navixa-quran-last-date",todayKey());
    setPage(nextPage);
    return()=>{ if("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  },[]);

  useEffect(()=>{
    if(!page)return;
    setQuranAyahs(null);setQuranError("");
    fetch(`/api/quran-page?page=${page}`).then(r=>r.json()).then(data=>{
      if(data?.data?.ayahs)setQuranAyahs(data.data.ayahs);
      else setQuranError("تعذر تحميل بيانات صفحة اليوم");
    }).catch(()=>setQuranError("تعذر تحميل بيانات صفحة اليوم"));
  },[page]);

  const firstAyah=quranAyahs?.[0];
  const lastAyah=quranAyahs?.[quranAyahs.length-1];
  const surah=firstAyah?.surah.name||"جارٍ التحميل…";
  const currentJuz=firstAyah?.juz;
  const currentHizb=firstAyah?.hizbQuarter?Math.ceil(firstAyah.hizbQuarter/4):undefined;
  const sameSurah=firstAyah?.surah.name===lastAyah?.surah.name;
  const ayahLabel=firstAyah&&lastAyah?(sameSurah?`${firstAyah.numberInSurah}–${lastAyah.numberInSurah}`:`${firstAyah.numberInSurah}–${lastAyah.numberInSurah}`):"—";

  const playGentleReminder=()=>{
    if(!("speechSynthesis" in window)){setQuranError("متصفحك لا يدعم التذكير الصوتي المحلي.");return;}
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(`خذ لحظة هادئة لوردك اليومي. صفحة ${page} من المصحف. سورة ${surah}. ابدأ بما تيسر. تقبل الله منك.`);
    utterance.lang="ar-SA";utterance.rate=.82;utterance.pitch=.96;
    utterance.onend=()=>setIsSpeaking(false);utterance.onerror=()=>setIsSpeaking(false);
    setIsSpeaking(true);window.speechSynthesis.speak(utterance);
  };
  const stopGentleReminder=()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();setIsSpeaking(false)};

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم — صفحة {page} من 604</small><h3>{surah}</h3><div className="quran-meta"><span>السورة: {surah}</span><span>الجزء: {currentJuz||"—"}</span><span>الحزب: {currentHizb||"—"}</span><span>الآيات: {ayahLabel}</span></div></div></header>
    <img className="quran-page-image" src={`https://quran.islam-db.com/data/pages/quranpages_1024/images/page${String(page).padStart(3,"0")}.png`} alt={`صورة صفحة المصحف رقم ${page} من سورة ${surah}`} loading="eager" />
    <div className="quran-audio-controls"><div><small>تذكير صوتي اختياري</small><b>استمع لبدء وردك بهدوء</b></div>{isSpeaking?<button type="button" onClick={stopGentleReminder}>إيقاف الصوت</button>:<button type="button" onClick={playGentleReminder}>▶ تشغيل التذكير</button>}</div>
    {quranError&&<p className="quran-error">{quranError}</p>}
    <a className="quran-full-link" href="https://qurancomplex.gov.sa/quran-hafs/" target="_blank" rel="noreferrer">فتح المصحف الكامل بالرسم الحفصي ↗</a>
    {!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
  </article>;
}

export {dayPage};
