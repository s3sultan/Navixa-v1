"use client";
import {useEffect,useRef,useState} from "react";
import "./worship.css";
import TasbihCounter from "./TasbihCounter";
import {sendTelegramAlert} from "./alertPrefs";

type Timings=Record<string,string>;
type AzkarItem={ID:number;ARABIC_TEXT:string;REPEAT:number};
type QuranAyah={number:number;text:string;numberInSurah:number;surah:{name:string}};

const prayerLabels:Record<string,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const prayerOrder=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const iqamaOffsets:Record<string,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
const today=()=>new Date().toISOString().slice(0,10);
const dayPage=()=>(Math.floor(Date.now()/86400000)%604)+1;
const tips=["الله يتقبل منك، استمر ✨","الثبات على القليل خير من كثير منقطع","ورد اليوم إنجاز يستحق الاحتفاء به","خطوة يومية بسيطة تبني عادة تدوم بإذن الله","أحسنت! استمراريتك اليوم تصنع فرقًا بكرة"];
const cleanTime=(value?:string)=>value?value.split(" ")[0]:"";
const parseToday=(hhmm:string)=>{const [h,m]=cleanTime(hhmm).split(":").map(Number);const d=new Date();if(Number.isFinite(h)&&Number.isFinite(m))d.setHours(h,m,0,0);return d};
const addMinutes=(date:Date,minutes:number)=>new Date(date.getTime()+minutes*60000);
const fmt=(date:Date)=>date.toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"});

export default function WorshipCenter(){
  const [locStatus,setLocStatus]=useState<"idle"|"loading"|"error"|"ready">("idle");
  const [manualCity,setManualCity]=useState("");
  const [manualCountry,setManualCountry]=useState("");
  const [timings,setTimings]=useState<Timings|null>(null);
  const [now,setNow]=useState(new Date());
  const [azkarList,setAzkarList]=useState<AzkarItem[]|null>(null);
  const [afterPrayerList,setAfterPrayerList]=useState<AzkarItem[]|null>(null);
  const [quranAyahs,setQuranAyahs]=useState<QuranAyah[]|null>(null);
  const [quranError,setQuranError]=useState("");
  const [wirdDone,setWirdDone]=useState(false);
  const [showSadaqah,setShowSadaqah]=useState(false);
  const [tipText,setTipText]=useState("");
  const [ehsanThanks,setEhsanThanks]=useState(false);
  const [fontSize,setFontSize]=useState(16);
  const [marks,setMarks]=useState<number[]>([]);
  const [lensOn,setLensOn]=useState(false);
  const [handMode,setHandMode]=useState(false);
  const [lensPos,setLensPos]=useState<{x:number;y:number}|null>(null);
  const [lensWidth,setLensWidth]=useState(0);
  const quranRef=useRef<HTMLDivElement>(null);
  const LENS=170;

  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{setWirdDone(localStorage.getItem(`navixa-wird-${today()}`)==="1")},[]);
  useEffect(()=>{
    fetch("/api/azkar?category=27").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAzkarList(d.items)}).catch(()=>{});
    fetch("/api/azkar?category=25").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAfterPrayerList(d.items)}).catch(()=>{});
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

  const applyTimings=(data:any)=>{if(data?.data?.timings){setTimings(data.data.timings);setLocStatus("ready")}else setLocStatus("error")};
  const requestLocation=()=>{
    if(!navigator.geolocation){setLocStatus("error");return}
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos=>fetch(`/api/prayer-times?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`).then(r=>r.json()).then(applyTimings).catch(()=>setLocStatus("error")),
      ()=>setLocStatus("error"),
      {timeout:10000}
    );
  };
  const submitCity=(e:React.FormEvent)=>{
    e.preventDefault();if(!manualCity||!manualCountry)return;
    setLocStatus("loading");
    fetch(`/api/prayer-times?city=${encodeURIComponent(manualCity)}&country=${encodeURIComponent(manualCountry)}`).then(r=>r.json()).then(applyTimings).catch(()=>setLocStatus("error"));
  };

  const hour=now.getHours()+now.getMinutes()/60;
  const azkarPeriod=hour>=3&&hour<12?"sabah":hour>=12&&hour<22?"masaa":null;

  let afterPrayerName:string|null=null;
  if(timings){
    for(let i=0;i<prayerOrder.length;i++){
      const name=prayerOrder[i];
      const adhan=parseToday(timings[name]);
      const windowStart=addMinutes(adhan,55);
      const nextAdhan=i<prayerOrder.length-1?parseToday(timings[prayerOrder[i+1]]):addMinutes(parseToday(timings.Fajr),24*60);
      if(now>=windowStart&&now<nextAdhan){afterPrayerName=name;break}
    }
  }

  let nextPrayer:{name:string;time:Date}|null=null;
  if(timings){
    for(const name of prayerOrder){const time=parseToday(timings[name]);if(time>now){nextPrayer={name,time};break}}
    if(!nextPrayer)nextPrayer={name:"Fajr",time:addMinutes(parseToday(timings.Fajr),24*60)};
  }

  const completeWird=()=>{
    localStorage.setItem(`navixa-wird-${today()}`,"1");
    const streak=Number(localStorage.getItem("navixa-wird-streak")||0)+1;
    localStorage.setItem("navixa-wird-streak",String(streak));
    setWirdDone(true);setShowSadaqah(true);setTipText(tips[Math.floor(Math.random()*tips.length)]);
    sendTelegramAlert("wird",`📖 تذكير NAVIXA: أنجز ورد اليوم (صفحة ${dayPage()}) — سلسلة ${streak} يوم`);
    sendTelegramAlert("sadaqah","🤲 تذكير NAVIXA: تذكير بالصدقة بعد إتمام الورد");
  };
  const clickEhsan=()=>{
    const next=Number(localStorage.getItem("navixa-ehsan-clicks")||1200)+1;
    localStorage.setItem("navixa-ehsan-clicks",String(next));
    setEhsanThanks(true);
    window.open("https://ehsan.sa","_blank","noopener,noreferrer");
  };

  const groupedAyahs:{surah:string;ayahs:QuranAyah[]}[]=[];
  (quranAyahs||[]).forEach(ayah=>{
    const last=groupedAyahs[groupedAyahs.length-1];
    if(last&&last.surah===ayah.surah.name)last.ayahs.push(ayah);else groupedAyahs.push({surah:ayah.surah.name,ayahs:[ayah]});
  });
  const renderQuranContent=()=>groupedAyahs.map(group=><div key={group.surah}><small>سورة {group.surah}</small><p>{group.ayahs.map(a=><span key={a.number} className={marks.includes(a.number)?"marked":""} onClick={()=>toggleMark(a.number)}>{a.text} <em>﴿{a.numberInSurah}﴾</em> </span>)}</p></div>);

  return <section className="worship-center" dir="rtl">
    <article className="prayer-card">
      <header><span className="card-explain-icon">🕌</span><div><small>مواقيت الصلاة والإقامة</small><h3>أوقاتك اليوم</h3></div></header>
      {locStatus!=="ready"&&<div className="location-request">
        <p>فعّل الموقع لعرض مواقيت الصلاة الدقيقة لمكانك، أو أدخل مدينتك يدويًا.</p>
        <button type="button" onClick={requestLocation} disabled={locStatus==="loading"}>{locStatus==="loading"?"جارٍ التحديد…":"📍 استخدم موقعي"}</button>
        <form onSubmit={submitCity}><input value={manualCity} onChange={e=>setManualCity(e.target.value)} placeholder="المدينة" required/><input value={manualCountry} onChange={e=>setManualCountry(e.target.value)} placeholder="الدولة" required/><button type="submit">تأكيد</button></form>
        {locStatus==="error"&&<small className="loc-error">تعذر تحديد موقعك — جرّب إدخال المدينة يدويًا.</small>}
      </div>}
      {timings&&<>
        <div className="prayer-grid">{prayerOrder.map(name=>{
          const adhan=parseToday(timings[name]);
          const iqama=addMinutes(adhan,iqamaOffsets[name]);
          return <div key={name} className={nextPrayer?.name===name?"active":""}>
            <b>{prayerLabels[name]}</b>
            <span>{fmt(adhan)}</span>
            <small>إقامة (تقديرية) {fmt(iqama)}</small>
          </div>
        })}</div>
        {nextPrayer&&<p className="next-prayer">القادمة: <b>{prayerLabels[nextPrayer.name]||"الفجر غدًا"}</b> — {fmt(nextPrayer.time)}</p>}
      </>}
    </article>

    {azkarPeriod&&azkarList&&<article className="azkar-card">
      <header><span className="card-explain-icon">{azkarPeriod==="sabah"?"🌅":"🌙"}</span><div><small>{azkarPeriod==="sabah"?"أذكار الصباح":"أذكار المساء"}</small><h3>حصّن يومك بالذكر</h3></div></header>
      <div className="azkar-list">{azkarList.map(item=><p key={item.ID}>{item.ARABIC_TEXT}{item.REPEAT>1&&<em> — تُقال {item.REPEAT} مرات</em>}</p>)}</div>
    </article>}

    {afterPrayerName&&afterPrayerList&&<article className="azkar-card after-prayer">
      <header><span className="card-explain-icon">🤲</span><div><small>أذكار بعد الصلاة</small><h3>بعد صلاة {prayerLabels[afterPrayerName]}</h3></div></header>
      <div className="azkar-list">{afterPrayerList.map(item=><p key={item.ID}>{item.ARABIC_TEXT}{item.REPEAT>1&&<em> — تُقال {item.REPEAT} مرات</em>}</p>)}</div>
    </article>}

    <article className="tasbih-card">
      <header><span className="card-explain-icon">📿</span><div><small>سبّح واستغفر</small><h3>عداد التسبيح اليومي</h3></div></header>
      <TasbihCounter/>
    </article>

    <article className="quran-card mushaf-frame">
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
      {!wirdDone?<button type="button" className="wird-done" onClick={completeWird} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
    </article>

    {showSadaqah&&<div className="sadaqah-back" onClick={()=>setShowSadaqah(false)}><article onClick={e=>e.stopPropagation()}>
      <button className="sadaqah-close" onClick={()=>setShowSadaqah(false)}>×</button>
      <span>🤲</span>
      <h3>{tipText}</h3>
      <p>الصدقة ولو يسيرة تجلب البركة وتفرّح قلبك — جرّب تتصدق اليوم عبر منصة إحسان الموثوقة.</p>
      <button type="button" className="ehsan-link" onClick={clickEhsan}>تصدق عبر منصة إحسان ↗</button>
      {ehsanThanks&&<small>جزاك الله خيرًا 🌱</small>}
    </article></div>}
  </section>
}
