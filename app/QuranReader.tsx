"use client";
import {useEffect,useMemo,useRef,useState} from "react";

type QuranAyah={number:number;numberInSurah:number;text?:string;surah:{name:string;number:number};juz?:number;hizbQuarter?:number};
type PageClip={verseKey:string;audioUrl:string;start:number;end:number};

const RECITERS=[{name:"بندر بليلة",source:"Quran.com",id:160},{name:"ياسر الدوسري",source:"Quran.com",id:174}] as const;
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
  const [lensOn,setLensOn]=useState(false);
  const [fontScale,setFontScale]=useState(1);
  const [targets,setTargets]=useState<Record<number,number>>({});
  const [counts,setCounts]=useState<Record<number,number>>({});
  const audioRef=useRef<HTMLAudioElement>(null);

  useEffect(()=>{const savedPage=Math.min(604,Math.max(1,Number(localStorage.getItem("navixa-quran-current-page")||1)));const savedDate=localStorage.getItem("navixa-quran-last-date");const nextPage=savedDate&&savedDate!==todayKey()?Math.min(604,savedPage+1):savedPage;localStorage.setItem("navixa-quran-current-page",String(nextPage));localStorage.setItem("navixa-quran-last-date",todayKey());setPage(nextPage);return()=>{audioRef.current?.pause()}},[]);
  useEffect(()=>{if(!page)return;setQuranAyahs(null);setQuranError("");setCounts({});setTargets({});fetch(`/api/quran-page?page=${page}`).then(r=>r.json()).then(data=>{if(data?.data?.ayahs)setQuranAyahs(data.data.ayahs);else setQuranError("تعذر تحميل بيانات صفحة اليوم")}).catch(()=>setQuranError("تعذر تحميل بيانات صفحة اليوم"))},[page]);

  const firstAyah=quranAyahs?.[0],lastAyah=quranAyahs?.[quranAyahs.length-1];
  const surah=firstAyah?.surah.name||"جارٍ التحميل…";
  const currentJuz=firstAyah?.juz,currentHizb=firstAyah?.hizbQuarter?Math.ceil(firstAyah.hizbQuarter/4):undefined;
  const ayahLabel=firstAyah&&lastAyah?`${firstAyah.numberInSurah}–${lastAyah.numberInSurah}`:"—";
  const reciter=useMemo(()=>dailyReciter(todayKey()),[]),activeClip=clips[clipIndex];

  useEffect(()=>{if(!quranAyahs?.length)return;let cancelled=false;const bySurah=[...new Set(quranAyahs.map(ayah=>ayah.surah.number))];setClips([]);setClipIndex(0);setIsPlaying(false);setAutoStart(false);Promise.all(bySurah.map(async surah=>{const response=await fetch(`/api/quran-page-audio?reciter=${reciter.id}&surah=${surah}`);if(!response.ok)throw new Error("audio unavailable");return [surah,await response.json() as {audioUrl:string;timestamps:Array<{verse_key:string;timestamp_from:number;timestamp_to:number}>}] as const})).then(entries=>{if(cancelled)return;const source=new Map(entries);const pageClips=quranAyahs.map(ayah=>{const details=source.get(ayah.surah.number),verseKey=`${ayah.surah.number}:${ayah.numberInSurah}`,timing=details?.timestamps.find(item=>item.verse_key===verseKey);return timing&&details?{verseKey,audioUrl:details.audioUrl,start:timing.timestamp_from/1000,end:timing.timestamp_to/1000}:null}).filter((clip):clip is PageClip=>clip!==null);if(!pageClips.length)throw new Error("no page clips");setClips(pageClips)}).catch(()=>{if(!cancelled)setQuranError("تعذر تجهيز تلاوة آيات هذه الصفحة.")});return()=>{cancelled=true}},[quranAyahs,reciter.id]);

  const startActiveClip=async()=>{const audio=audioRef.current;if(!audio||!activeClip)return;try{if(audio.readyState<1){audio.load();return}audio.currentTime=activeClip.start;await audio.play()}catch{setAutoStart(false);setQuranError("تعذر تشغيل التلاوة. تحقق من اتصالك ثم حاول مرة أخرى.")}};
  const toggleRecitation=()=>{const audio=audioRef.current;if(!audio||!activeClip)return;if(isPlaying){setAutoStart(false);audio.pause();return}setQuranError("");setAutoStart(true);void startActiveClip()};
  const advanceClip=()=>{const audio=audioRef.current;if(!audio)return;const nextClip=clips[clipIndex+1];if(!nextClip){setAutoStart(false);setIsPlaying(false);audio.pause();return}setClipIndex(index=>index+1);if(nextClip.audioUrl===activeClip?.audioUrl){audio.currentTime=nextClip.start;void audio.play().catch(()=>{setAutoStart(false);setQuranError("تعذر متابعة التلاوة.")})}};
  const tapAyah=(ayah:QuranAyah)=>{const target=targets[ayah.number]||1;setCounts(current=>({...current,[ayah.number]:Math.min(target,(current[ayah.number]||0)+1)}))};
  const setTarget=(ayah:QuranAyah,target:number)=>{setTargets(current=>({...current,[ayah.number]:target}));setCounts(current=>({...current,[ayah.number]:Math.min(current[ayah.number]||0,target)}))};

  return <article className="quran-card mushaf-frame">
    <header><span className="card-explain-icon">📗</span><div><small>ورد اليوم · صفحة {page} من 604</small><h3>{surah}</h3><div className="quran-meta"><span>السورة: {surah}</span><span>الجزء: {currentJuz||"—"}</span><span>الحزب: {currentHizb||"—"}</span><span>الآيات: {ayahLabel}</span></div></div></header>
    <div className="quran-toolbar"><div className="zoom-group"><button type="button" onClick={()=>setFontScale(v=>Math.max(.85,Number((v-.1).toFixed(2))))}>أ−</button><span>{Math.round(fontScale*100)}%</span><button type="button" onClick={()=>setFontScale(v=>Math.min(1.6,Number((v+.1).toFixed(2))))}>أ+</button></div><button type="button" className={lensOn?"tool-toggle on":"tool-toggle"} onClick={()=>setLensOn(v=>!v)}>🔎 {lensOn?"إيقاف التكبير":"تكبير القراءة"}</button></div>
    {quranAyahs?.length?<section className={`quran-verse-grid${lensOn?" is-magnified":""}`} style={{"--quran-scale":fontScale} as React.CSSProperties}>{quranAyahs.map(ayah=>{const target=targets[ayah.number]||1,count=counts[ayah.number]||0,done=count>=target;return <article key={ayah.number} className={`quran-verse-card${done?" is-done":""}`}><button type="button" className="quran-verse-tap" onClick={()=>tapAyah(ayah)}><span>{ayah.text||""}</span><i>{ayah.numberInSurah}</i><em>{target>1?`اضغط بعد كل قراءة · ${count} / ${target}`:done?"تمت القراءة ✓":"اضغط عند إتمام القراءة"}</em></button><div className="quran-repeat-choices"><small>التكرار:</small>{[1,3,7].map(value=><button type="button" key={value} className={target===value?"active":""} onClick={()=>setTarget(ayah,value)}>{value}</button>)}</div></article>})}</section>:<div className="quran-page-skeleton">جارٍ تجهيز آيات وردك…</div>}
    <details className="quran-page-preview"><summary>عرض صورة صفحة المصحف الأصلية</summary><img className="quran-page-image" src={`https://quran.islam-db.com/data/pages/quranpages_1024/images/page${String(page).padStart(3,"0")}.png`} alt={`صفحة المصحف رقم ${page} من ${surah}`} loading="lazy" /></details>
    <div className="quran-reader-actions"><div className="quran-audio-controls"><div><small>تلاوة آيات الصفحة · {reciter.name}</small><b>استمع إلى آيات الورد الظاهرة فقط</b><em>{clips.length?`الآية ${clipIndex+1} من ${clips.length}`:"يُجهّز مقطع الصفحة"}</em></div><audio ref={audioRef} src={activeClip?.audioUrl} preload="metadata" onCanPlay={()=>{if(autoStart)void startActiveClip()}} onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onTimeUpdate={()=>{const audio=audioRef.current;if(audio&&activeClip&&audio.currentTime>=activeClip.end)advanceClip()}} onEnded={advanceClip} onError={()=>{setAutoStart(false);setIsPlaying(false);setQuranError("تعذر تحميل التلاوة.")}} />{isPlaying?<button type="button" onClick={toggleRecitation}>إيقاف التلاوة</button>:<button type="button" onClick={toggleRecitation} disabled={!activeClip}>▶ تشغيل تلاوة الصفحة</button>}</div>{quranError&&<p className="quran-error">{quranError}</p>}<div className="quran-reader-footer"><a className="quran-full-link" href="https://qurancomplex.gov.sa/quran-hafs/" target="_blank" rel="noreferrer">فتح المصحف الكامل ↗</a>{!wirdDone?<button type="button" className="wird-done" onClick={onComplete} disabled={!quranAyahs}>تم · أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم · بارك الله فيك</p>}</div></div>
  </article>;
}

export {dayPage};
