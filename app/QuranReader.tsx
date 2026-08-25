"use client";
import {useEffect,useMemo,useRef,useState} from "react";

type QuranAyah={number:number;numberInSurah:number;surah:{name:string;number:number};juz?:number;hizbQuarter?:number};

const RECITERS=[
  {name:"بندر بليلة",source:"Quran.com",url:(surah:number)=>`https://download.quranicaudio.com/quran/bandar_baleela/complete/${String(surah).padStart(3,"0")}.mp3`},
  {name:"ياسر الدوسري",source:"Quran.com",url:(surah:number)=>`https://download.quranicaudio.com/qdc/yasser_ad-dussary/mp3/${surah}.mp3`},
  {name:"خالد الجليل",source:"MP3Quran",url:(surah:number)=>`https://server10.mp3quran.net/jleel/${String(surah).padStart(3,"0")}.mp3`},
] as const;

const dailyReciter=(date:string)=>RECITERS[[...date].reduce((total,char)=>total+char.charCodeAt(0),0)%RECITERS.length];

const todayKey=()=>new Date().toISOString().slice(0,10);
const dayPage=()=>typeof window==="undefined"?1:Number(localStorage.getItem("navixa-quran-current-page")||1);

export default function QuranReader({wirdDone,onComplete}:{wirdDone:boolean;onComplete:()=>void}){
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [page,setPage]=useState(1);
  const [quranError,setQuranError]=useState("");
  const [isPlaying,setIsPlaying]=useState(false);
  const audioRef=useRef<HTMLAudioElement>(null);

  useEffect(()=>{
    const savedPage=Math.min(604,Math.max(1,Number(localStorage.getItem("navixa-quran-current-page")||1)));
    const savedDate=localStorage.getItem("navixa-quran-last-date");
    const nextPage=savedDate&&savedDate!==todayKey()?Math.min(604,savedPage+1):savedPage;
    localStorage.setItem("navixa-quran-current-page",String(nextPage));
    localStorage.setItem("navixa-quran-last-date",todayKey());
    setPage(nextPage);
    return()=>{ audioRef.current?.pause(); };
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
  const reciter=useMemo(()=>dailyReciter(todayKey()),[]);
  const audioUrl=firstAyah?reciter.url(firstAyah.surah.number):"";

  const toggleRecitation=async()=>{const audio=audioRef.current;if(!audio||!audioUrl)return;if(isPlaying){audio.pause();return}try{setQuranError("");await audio.play()}catch{setQuranError("تعذر تشغيل التلاوة. تحقق من اتصالك ثم حاول مرة أخرى.")}};

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم — صفحة {page} من 604</small><h3>{surah}</h3><div className="quran-meta"><span>السورة: {surah}</span><span>الجزء: {currentJuz||"—"}</span><span>الحزب: {currentHizb||"—"}</span><span>الآيات: {ayahLabel}</span></div></div></header>
    <img className="quran-page-image" src={`https://quran.islam-db.com/data/pages/quranpages_1024/images/page${String(page).padStart(3,"0")}.png`} alt={`صورة صفحة المصحف رقم ${page} من سورة ${surah}`} loading="eager" />
    <div className="quran-audio-controls"><div><small>تلاوة ورد اليوم · {reciter.name}</small><b>استمع إلى سورة {surah}</b><em>قارئ اليوم يتغير تلقائيًا مع الورد</em></div><audio ref={audioRef} src={audioUrl} preload="none" onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onEnded={()=>setIsPlaying(false)} onError={()=>{setIsPlaying(false);setQuranError("تعذر تحميل تلاوة السورة من مصدرها الصوتي.")}} />{isPlaying?<button type="button" onClick={toggleRecitation}>إيقاف التلاوة</button>:<button type="button" onClick={toggleRecitation} disabled={!audioUrl}>▶ تشغيل تلاوة السورة</button>}</div>
    {quranError&&<p className="quran-error">{quranError}</p>}
    <a className="quran-full-link" href="https://qurancomplex.gov.sa/quran-hafs/" target="_blank" rel="noreferrer">فتح المصحف الكامل بالرسم الحفصي ↗</a>
    {!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
  </article>;
}

export {dayPage};
