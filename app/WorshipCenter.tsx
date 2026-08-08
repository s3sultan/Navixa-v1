"use client";
import {useEffect,useState} from "react";
import "./worship.css";
import TasbihCounter from "./TasbihCounter";

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
  const [ehsanThanks,setEhsanThanks]=useState(false);

  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{setWirdDone(localStorage.getItem(`navixa-wird-${today()}`)==="1")},[]);
  useEffect(()=>{
    fetch("/api/azkar?category=27").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAzkarList(d.items)}).catch(()=>{});
    fetch("/api/azkar?category=25").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAfterPrayerList(d.items)}).catch(()=>{});
    const page=dayPage();
    fetch(`/api/quran-page?page=${page}`).then(r=>r.json()).then(d=>{if(d?.data?.ayahs)setQuranAyahs(d.data.ayahs);else setQuranError("تعذر تحميل صفحة اليوم")}).catch(()=>setQuranError("تعذر تحميل صفحة اليوم"));
  },[]);

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

  const notifyTelegram=(message:string)=>{void fetch("/api/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message})}).catch(()=>{})};
  const completeWird=()=>{
    localStorage.setItem(`navixa-wird-${today()}`,"1");
    const streak=Number(localStorage.getItem("navixa-wird-streak")||0)+1;
    localStorage.setItem("navixa-wird-streak",String(streak));
    setWirdDone(true);setShowSadaqah(true);
    notifyTelegram(`📖 تذكير NAVIXA: أنجز ورد اليوم (صفحة ${dayPage()}) — سلسلة ${streak} يوم`);
    notifyTelegram("🤲 تذكير NAVIXA: تذكير بالصدقة بعد إتمام الورد");
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

  return <section className="worship-center" dir="rtl">
    <article className="prayer-card">
      <header><small>مواقيت الصلاة والإقامة</small><h3>أوقاتك اليوم</h3></header>
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
      <header><small>{azkarPeriod==="sabah"?"أذكار الصباح":"أذكار المساء"}</small><h3>حصّن يومك بالذكر</h3></header>
      <div className="azkar-list">{azkarList.map(item=><p key={item.ID}>{item.ARABIC_TEXT}{item.REPEAT>1&&<em> — تُقال {item.REPEAT} مرات</em>}</p>)}</div>
    </article>}

    {afterPrayerName&&afterPrayerList&&<article className="azkar-card after-prayer">
      <header><small>أذكار بعد الصلاة</small><h3>بعد صلاة {prayerLabels[afterPrayerName]}</h3></header>
      <div className="azkar-list">{afterPrayerList.map(item=><p key={item.ID}>{item.ARABIC_TEXT}{item.REPEAT>1&&<em> — تُقال {item.REPEAT} مرات</em>}</p>)}</div>
    </article>}

    <article className="tasbih-card">
      <header><small>سبّح واستغفر</small><h3>عداد التسبيح اليومي</h3></header>
      <TasbihCounter/>
    </article>

    <article className="quran-card">
      <header><small>ورد اليوم — صفحة {dayPage()}</small><h3>{groupedAyahs[0]?.surah||"جارٍ التحميل…"}</h3></header>
      {quranError&&<p className="quran-error">{quranError}</p>}
      <div className="quran-text">{groupedAyahs.map(group=><div key={group.surah}><small>سورة {group.surah}</small><p>{group.ayahs.map(a=>`${a.text} ﴿${a.numberInSurah}﴾`).join(" ")}</p></div>)}</div>
      {!wirdDone?<button type="button" className="wird-done" onClick={completeWird} disabled={!quranAyahs}>تم — أنجزت ورد اليوم</button>:<p className="wird-complete">✓ أنجزت ورد اليوم — بارك الله فيك</p>}
    </article>

    {showSadaqah&&<div className="sadaqah-back" onClick={()=>setShowSadaqah(false)}><article onClick={e=>e.stopPropagation()}>
      <button className="sadaqah-close" onClick={()=>setShowSadaqah(false)}>×</button>
      <span>🤲</span>
      <h3>{tips[Math.floor(Math.random()*tips.length)]}</h3>
      <p>الصدقة ولو يسيرة تجلب البركة وتفرّح قلبك — جرّب تتصدق اليوم عبر منصة إحسان الموثوقة.</p>
      <button type="button" className="ehsan-link" onClick={clickEhsan}>تصدق عبر منصة إحسان ↗</button>
      {ehsanThanks&&<small>جزاك الله خيرًا 🌱</small>}
    </article></div>}
  </section>
}
