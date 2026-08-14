"use client";
import {useEffect,useState} from "react";
import "./worship.css";
import TasbihCounter from "./TasbihCounter";
import AzkarList from "./AzkarList";
import QuranReader,{dayPage} from "./QuranReader";
import {sendTelegramAlert} from "./alertPrefs";

type Timings=Record<string,string>;
type AzkarItem={ID:number;ARABIC_TEXT:string;REPEAT:number};

const prayerLabels:Record<string,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const prayerOrder=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const iqamaOffsets:Record<string,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
const today=()=>new Date().toISOString().slice(0,10);
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
  const [wirdDone,setWirdDone]=useState(false);
  const [showSadaqah,setShowSadaqah]=useState(false);
  const [tipText,setTipText]=useState("");
  const [ehsanThanks,setEhsanThanks]=useState(false);
  const [donationReason,setDonationReason]=useState("وردك اليومي");

  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{setWirdDone(localStorage.getItem(`navixa-wird-${today()}`)==="1")},[]);
  useEffect(()=>{
    fetch("/api/azkar?category=27").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAzkarList(d.items)}).catch(()=>{});
    fetch("/api/azkar?category=25").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAfterPrayerList(d.items)}).catch(()=>{});
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

  const showDonation=(reason:string)=>{setDonationReason(reason);setTipText("أحسنت، تقبّل الله وردك — صدقة يسيرة قد تفتح باب خير كبير.");setShowSadaqah(true);sendTelegramAlert("sadaqah",`🤲 تذكير NAVIXA: تذكير بالصدقة بعد إتمام ${reason}`)};
  const completeWird=()=>{
    localStorage.setItem(`navixa-wird-${today()}`,"1");
    const streak=Number(localStorage.getItem("navixa-wird-streak")||0)+1;
    localStorage.setItem("navixa-wird-streak",String(streak));
    setWirdDone(true);showDonation("ورد القرآن");
    sendTelegramAlert("wird",`📖 تذكير NAVIXA: أنجز ورد اليوم (صفحة ${dayPage()}) — سلسلة ${streak} يوم`);
    sendTelegramAlert("sadaqah","🤲 تذكير NAVIXA: تذكير بالصدقة بعد إتمام الورد");
  };
  const clickEhsan=()=>{
    const next=Number(localStorage.getItem("navixa-ehsan-clicks")||1200)+1;
    localStorage.setItem("navixa-ehsan-clicks",String(next));
    const stored=localStorage.getItem("navixa-stats-visitor-key");const visitorKey=stored||((crypto as any).randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`);if(!stored)localStorage.setItem("navixa-stats-visitor-key",visitorKey);
    fetch("/api/stats",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:"ehsan",visitorKey})}).catch(()=>{});
    setEhsanThanks(true);
    window.open("https://ehsan.sa","_blank","noopener,noreferrer");
  };

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
      <AzkarList items={azkarList}/><button type="button" className="wird-done" onClick={()=>showDonation("أذكار اليوم")}>تم إتمام الأذكار — تذكير بالصدقة</button>
    </article>}

    {afterPrayerName&&afterPrayerList&&<article className="azkar-card after-prayer">
      <header><span className="card-explain-icon">🤲</span><div><small>أذكار بعد الصلاة</small><h3>بعد صلاة {prayerLabels[afterPrayerName]}</h3></div></header>
      <AzkarList items={afterPrayerList}/><button type="button" className="wird-done" onClick={()=>showDonation(`أذكار بعد صلاة ${prayerLabels[afterPrayerName]}`)}>تم إتمام الأذكار — تذكير بالصدقة</button>
    </article>}

    <article className="tasbih-card">
      <header><span className="card-explain-icon">📿</span><div><small>سبّح واستغفر</small><h3>عداد التسبيح اليومي</h3></div></header>
      <TasbihCounter onComplete={()=>showDonation("ورد التسبيح")}/>
    </article>

    <QuranReader wirdDone={wirdDone} onComplete={completeWird}/>

    {showSadaqah&&<div className="sadaqah-back" onClick={()=>setShowSadaqah(false)}><article onClick={e=>e.stopPropagation()}>
      <button className="sadaqah-close" onClick={()=>setShowSadaqah(false)}>×</button>
      <span>🤲</span>
      <h3>{tipText}</h3><small className="donation-reason">بعد إتمام {donationReason}</small>
      <p>الصدقة ولو يسيرة تجلب البركة وتفرّح قلبك — جرّب تتصدق اليوم عبر منصة إحسان الموثوقة.</p>
      <button type="button" className="ehsan-link" onClick={clickEhsan}>تصدق عبر منصة إحسان ↗</button>
      {ehsanThanks&&<small>جزاك الله خيرًا 🌱</small>}
    </article></div>}
  </section>
}
