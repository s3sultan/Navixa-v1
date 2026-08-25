"use client";
import {useEffect,useMemo,useRef,useState} from "react";

type QuranAyah={number:number;numberInSurah:number;text?:string;surah:{name:string;number:number};juz?:number;hizbQuarter?:number};
type PageClip={verseKey:string;audioUrl:string;start:number;end:number};

const RECITERS=[
  {name:"بندر بليلة",source:"Quran.com",id:160},
  {name:"ياسر الدوسري",source:"Quran.com",id:174},
] as const;

const dailyReciter=(date:string)=>RECITERS[[...date].reduce((total,char)=>total+char.charCodeAt(0),0)%RECITERS.length];

const todayKey=()=>new Date().toISOString().slice(0,10);
const dayPage=()=>typeof window==="undefined"?1:Number(localStorage.getItem("navixa-quran-current-page")||1);

export default function QuranReader({wirdDone,onComplete}:{wirdDone:boolean;onComplete:()=>void}){
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [page,setPage]=useState(1);
  const [quranError,setQuranError]=useState("");
  const [isPlaying,setIsPlaying]=useState(false);
  const [clips,setClips]=useState<PageClip[]>([]);
  const [clipIndex,setClipIndex]=useState(0);
  const [autoStart,setAutoStart]=useState(false);
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
  const activeClip=clips[clipIndex];

  useEffect(()=>{
    if(!quranAyahs?.length)return;
    let cancelled=false;
    const bySurah=[...new Set(quranAyahs.map(ayah=>ayah.surah.number))];
    setClips([]);setClipIndex(0);setIsPlaying(false);setAutoStart(false);
    Promise.all(bySurah.map(async surah=>{
      const response=await fetch(`/api/quran-page-audio?reciter=${reciter.id}&surah=${surah}`);
      if(!response.ok)throw new Error("audio unavailable");
      return [surah,await response.json() as {audioUrl:string;timestamps:Array<{verse_key:string;timestamp_from:number;timestamp_to:number}>}] as const;
    })).then(entries=>{
      if(cancelled)return;
      const source=new Map(entries);
      const pageClips=quranAyahs.map(ayah=>{
        const details=source.get(ayah.surah.number)?.[1];
        const verseKey=`${ayah.surah.number}:${ayah.numberInSurah}`;
        const timing=details?.timestamps.find(item=>item.verse_key===verseKey);
        return timing&&details?{verseKey,audioUrl:details.audioUrl,start:timing.timestamp_from/1000,end:timing.timestamp_to/1000}:null;
      }).filter((clip):clip is PageClip=>clip!==null);
      if(!pageClips.length)throw new Error("no page clips");
      setClips(pageClips);
    }).catch(()=>{if(!cancelled)setQuranError("تعذر تجهيز تلاوة آيات هذه الصفحة.")});
    return()=>{cancelled=true};
  },[quranAyahs,reciter.id]);

  const toggleRecitation=async()=>{const audio=audioRef.current;if(!audio||!activeClip)return;if(isPlaying){setAutoStart(false);audio.pause();return}try{setQuranError("");setAutoStart(true);audio.currentTime=activeClip.start;await audio.play()}catch{setQuranError("تعذر تشغيل التلاوة. تحقق من اتصالك ثم حاول مرة أخرى.")}};
  const advanceClip=()=>{const audio=audioRef.current;if(!audio)return;if(clipIndex>=clips.length-1){setAutoStart(false);setIsPlaying(false);audio.pause();return}audio.pause();setClipIndex(index=>index+1)};
  const handleClipReady=()=>{const audio=audioRef.current;if(!audio||!activeClip||!autoStart)return;audio.currentTime=activeClip.start;audio.play().catch(()=>setQuranError("تعذر تشغيل التلاوة. تحقق من اتصالك ثم حاول مرة أخرى."))};
  const handleTimeUpdate=()=>{const audio=audioRef.current;if(audio&&activeClip&&audio.currentTime>=activeClip.end)advanceClip()};

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم — صفحة {page} من 604</small><h3>{surah}</h3><div className="quran-meta"><span>السورة: {surah}</span><span>الجزء: {currentJuz||"—"}</span><span>الحزب: {currentHizb||"—"}</span><span>الآيات: {ayahLabel}</span></div></div></header>
    <div className="quran-reading-panel" aria-label={`آيات صفحة الورد ${page}`}>
      <div className="quran-reading-heading"><span>صفحة الورد</span><b>{surah}</b><small>من الآية {ayahLabel}</small></div>
      <div className="quran-ayahs">{quranAyahs?.length?quranAyahs.map(ayah=><span key={ayah.number}>{ayah.text||"…"}<i>{ayah.numberInSurah}</i></span>):<p>يُجهّز نص آيات هذه الصفحة…</p>}</div>
    </div>
    <div className="quran-reader-actions"><div className="quran-audio-controls"><div><small>تلاوة آيات الصفحة · {reciter.name}</small><b>استمع إلى آيات الورد الظاهرة فقط</b><em>{clips.length?`الآية ${clipIndex+1} من ${clips.length} في هذه الصفحة`:`يُجهّز مقطع الصفحة`}</em></div><audio ref={audioRef} src={activeClip?.audioUrl} preload="metadata" onCanPlay={handleClipReady} onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onTimeUpdate={handleTimeUpdate} onEnded={advanceClip} onError={()=>{setAutoStart(false);setIsPlaying(false);setQuranError("تعذر تحميل تلاوة آيات الصفحة من مصدرها الصوتي.")}} />{isPlaying?<button type="button" onClick={toggleRecitation}>إيقاف التلاوة</button>:<button type="button" onClick={toggleRecitation} disabled={!activeClip}>▶ تشغيل تلاوة الصفحة</button>}</div>{quranError&&<p className="quran-error">{quranError}</p>}<div className="quran-reader-footer"><a className="quran-full-link" href="https://qurancomplex.gov.sa/quran-hafs/" target="_blank" rel="noreferrer">فتح المصحف الكامل ↗</a>{!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}</div></div>
  </article>;
}

export {dayPage};
