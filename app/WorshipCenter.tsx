"use client";
import {useEffect,useState} from "react";
import "./worship.css";
import TasbihCounter from "./TasbihCounter";
import AzkarList from "./AzkarList";
import QuranReader,{dayPage} from "./QuranReader";
import {sendTelegramAlert} from "./alertPrefs";
import {RIYADH,addMinutes,applyAdjustments,defaultIqamaOffset,parseTime,prayerApiUrl,prayerLabels,prayerOrder,readAdjustments,type Timings} from "./prayerTimeModel";
import {prayerLocationRequest,readSharedPrayerLocation,subscribePrayerLocation,writeSharedPrayerLocation,type SharedPrayerLocation} from "./prayerLocationModel";

type AzkarItem={ID:number;ARABIC_TEXT:string;REPEAT:number};
type LocStatus="idle"|"loading"|"denied"|"unavailable"|"timeout"|"error"|"ready";
const today=()=>new Date().toISOString().slice(0,10);
const fmt=(date:Date)=>date.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true});

export default function WorshipCenter(){
  const [locStatus,setLocStatus]=useState<LocStatus>("idle");
  const [locationLabel,setLocationLabel]=useState("لم يُحدد الموقع بعد");
  const [manualCity,setManualCity]=useState("");
  const [manualCountry,setManualCountry]=useState("Saudi Arabia");
  const [timings,setTimings]=useState<Timings|null>(null);
  const [now,setNow]=useState(new Date());
  const [azkarList,setAzkarList]=useState<AzkarItem[]|null>(null);
  const [afterPrayerList,setAfterPrayerList]=useState<AzkarItem[]|null>(null);
  const [wirdDone,setWirdDone]=useState(false),[azkarDone,setAzkarDone]=useState(false),[tasbihDone,setTasbihDone]=useState(false);
  const [wirdStreak,setWirdStreak]=useState(0),[showSadaqah,setShowSadaqah]=useState(false),[tipText,setTipText]=useState(""),[ehsanThanks,setEhsanThanks]=useState(false),[donationReason,setDonationReason]=useState("وردك اليومي");

  const applyTimings=(data:any)=>{if(data?.data?.timings){setTimings(applyAdjustments(data.data.timings,readAdjustments()));setLocStatus("ready")}else setLocStatus("error")};
  const fetchTimings=async(input:{lat?:number;lng?:number;city?:string;country?:string})=>{setLocStatus("loading");try{const r=await fetch(prayerApiUrl(input),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error();applyTimings(d)}catch{setLocStatus("error")}};
  const applyLocation=(location:SharedPrayerLocation)=>{setLocationLabel(location.label);if(location.mode==="city"){setManualCity(location.city);setManualCountry(location.country)}void fetchTimings(prayerLocationRequest(location))};

  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{const day=today();setWirdDone(localStorage.getItem(`navixa-wird-${day}`)==="1");setAzkarDone(localStorage.getItem(`navixa-azkar-${day}`)==="1");setTasbihDone(localStorage.getItem(`navixa-tasbih-${day}`)==="1");setWirdStreak(Number(localStorage.getItem("navixa-wird-streak")||0));const saved=readSharedPrayerLocation();if(saved)applyLocation(saved)},[]);
  useEffect(()=>subscribePrayerLocation(applyLocation),[]);
  useEffect(()=>{fetch("/api/azkar?category=27").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAzkarList(d.items)}).catch(()=>{});fetch("/api/azkar?category=25").then(r=>r.json()).then(d=>{if(Array.isArray(d.items))setAfterPrayerList(d.items)}).catch(()=>{})},[]);

  const requestLocation=()=>{if(!navigator.geolocation){setLocStatus("unavailable");return}setLocStatus("loading");navigator.geolocation.getCurrentPosition(pos=>{const saved:SharedPrayerLocation={mode:"coords",lat:pos.coords.latitude,lng:pos.coords.longitude,label:"موقع جهازك",source:"device"};writeSharedPrayerLocation(saved);applyLocation(saved)},error=>{if(error.code===1)setLocStatus("denied");else if(error.code===2)setLocStatus("unavailable");else if(error.code===3)setLocStatus("timeout");else setLocStatus("error")},{enableHighAccuracy:true,timeout:12000,maximumAge:0})};
  const useRiyadhFallback=()=>{const saved:SharedPrayerLocation={mode:"coords",...RIYADH,label:"الرياض افتراضيًا",source:"fallback"};writeSharedPrayerLocation(saved);applyLocation(saved)};
  const submitCity=(e:React.FormEvent)=>{e.preventDefault();const city=manualCity.trim(),country=manualCountry.trim();if(!city||!country)return;const saved:SharedPrayerLocation={mode:"city",city,country,label:`${city}، ${country}`,source:"manual"};writeSharedPrayerLocation(saved);applyLocation(saved)};

  const hour=now.getHours()+now.getMinutes()/60,azkarPeriod=hour>=3&&hour<12?"sabah":hour>=12&&hour<22?"masaa":null;
  let afterPrayerName:keyof typeof prayerLabels|null=null;if(timings){for(let i=0;i<prayerOrder.length;i++){const name=prayerOrder[i],adhan=parseTime(timings[name]),windowStart=addMinutes(adhan,55),nextAdhan=i<prayerOrder.length-1?parseTime(timings[prayerOrder[i+1]]):addMinutes(parseTime(timings.Fajr),1440);if(now>=windowStart&&now<nextAdhan){afterPrayerName=name;break}}}
  let nextPrayer:{name:keyof typeof prayerLabels;time:Date}|null=null;if(timings){for(const name of prayerOrder){const time=parseTime(timings[name]);if(time>now){nextPrayer={name,time};break}}if(!nextPrayer)nextPrayer={name:"Fajr",time:addMinutes(parseTime(timings.Fajr),1440)}};

  const showDonation=(reason:string)=>{setDonationReason(reason);setTipText("أحسنت، تقبّل الله وردك");setShowSadaqah(true);sendTelegramAlert("sadaqah",`🤲 تذكير NAVIXA: تذكير بالصدقة بعد إتمام ${reason}`)};
  const completeWird=()=>{localStorage.setItem(`navixa-wird-${today()}`,"1");const streak=Number(localStorage.getItem("navixa-wird-streak")||0)+1;localStorage.setItem("navixa-wird-streak",String(streak));setWirdStreak(streak);setWirdDone(true);showDonation("ورد القرآن");sendTelegramAlert("wird",`📖 أنجز ورد اليوم (صفحة ${dayPage()}) · سلسلة ${streak} يوم`)};
  const completeAzkar=()=>{localStorage.setItem(`navixa-azkar-${today()}`,"1");setAzkarDone(true);showDonation("أذكار اليوم")};
  const completeTasbih=()=>{localStorage.setItem(`navixa-tasbih-${today()}`,"1");setTasbihDone(true);showDonation("ورد التسبيح")};
  const clickEhsan=()=>{setEhsanThanks(true);window.open("https://ehsan.sa","_blank","noopener,noreferrer")};
  const completedCount=[wirdDone,azkarDone,tasbihDone].filter(Boolean).length,hijriDate=now.toLocaleDateString("ar-SA-u-ca-islamic",{weekday:"long",day:"numeric",month:"long"});
  const locMessage=locStatus==="denied"?"إذن الموقع مرفوض في المتصفح. فعّل الموقع لهذا الموقع ثم اضغط «استخدم موقعي» مرة أخرى.":locStatus==="unavailable"?"الموقع غير متاح من الجهاز أو المتصفح حاليًا.":locStatus==="timeout"?"استغرق تحديد الموقع وقتًا طويلًا. جرّب مرة أخرى أو اختر المدينة يدويًا.":locStatus==="error"?"تعذر جلب المواقيت. يمكنك استخدام الرياض مؤقتًا أو إدخال المدينة.":"";

  return <section className="worship-center worship-center-v2" dir="rtl">
    <article className="worship-hero worship-hero-v2"><div className="worship-hero-copy"><span className="worship-kicker">وردك اليومي</span><h2>صفحة هادئة للقراءة والذكر</h2><p>{hijriDate} · كل شيء مرتب أمامك بدون زحمة.</p><nav className="worship-jump-links"><a href="#daily-quran">القرآن</a><a href="#daily-azkar">الأذكار</a><a href="#daily-tasbih">التسبيح</a><a href="#daily-prayer">الصلاة</a></nav></div><div className="worship-hero-progress"><div className="worship-progress-ring" style={{"--worship-progress":`${completedCount/3*100}%`} as React.CSSProperties}><b>{completedCount}<small>/3</small></b></div><div><strong>{completedCount===3?"اكتمل وردك اليوم":"خطواتك اليوم"}</strong><span>{completedCount===3?"تقبّل الله منك":"أنجز ما يناسبك"}</span></div></div><div className="worship-streak"><span>✦</span><div><small>سلسلة القرآن</small><b>{wirdStreak} يوم</b></div></div></article>
    <div id="daily-quran"><QuranReader wirdDone={wirdDone} onComplete={completeWird}/></div>
    {azkarPeriod&&azkarList&&<article className="azkar-card" id="daily-azkar"><header><span className="card-explain-icon">{azkarPeriod==="sabah"?"🌅":"🌙"}</span><div><small>{azkarPeriod==="sabah"?"أذكار الصباح":"أذكار المساء"}</small><h3>اقرأ واضغط ليحسب NAVIXA التكرار</h3></div></header><AzkarList items={azkarList}/><button type="button" className={`wird-done ${azkarDone?"is-complete":""}`} onClick={completeAzkar}>{azkarDone?"تم إتمام أذكار اليوم ✓":"تم إتمام الأذكار"}</button></article>}
    {afterPrayerName&&afterPrayerList&&<article className="azkar-card after-prayer"><header><span className="card-explain-icon">🤲</span><div><small>أذكار بعد الصلاة</small><h3>بعد صلاة {prayerLabels[afterPrayerName]}</h3></div></header><AzkarList items={afterPrayerList}/></article>}
    <article className="tasbih-card" id="daily-tasbih"><header><span className="card-explain-icon">📿</span><div><small>سبّح واستغفر</small><h3>عداد التسبيح اليومي</h3></div></header><TasbihCounter onComplete={completeTasbih}/>{tasbihDone&&<p className="worship-inline-complete">أتممت ورد التسبيح اليوم ✓</p>}</article>
    <article className="prayer-card prayer-card-v2" id="daily-prayer"><header><span className="card-explain-icon">🕌</span><div><small>تقويم أم القرى</small><h3>مواقيت الصلاة المتغيرة يوميًا</h3><p className="prayer-source-note">الموقع هنا هو نفسه المستخدم في شريط الصلاة أعلى الصفحة. أي تعديل على أحدهما ينعكس على الآخر مباشرة.</p></div></header><div className="location-status-panel"><div><small>الموقع الحالي</small><b>{locationLabel}</b></div><button type="button" onClick={requestLocation} disabled={locStatus==="loading"}>{locStatus==="loading"?"جارٍ التحديد…":"📍 استخدم موقعي"}</button><button type="button" className="ghost" onClick={useRiyadhFallback}>استخدم الرياض مؤقتًا</button></div>{locMessage&&<p className="loc-help">{locMessage}</p>}<form className="manual-location-form" onSubmit={submitCity}><input value={manualCity} onChange={e=>setManualCity(e.target.value)} placeholder="المدينة" required/><input value={manualCountry} onChange={e=>setManualCountry(e.target.value)} placeholder="الدولة" required/><button type="submit">اعتماد المدينة</button></form>{timings&&<><div className="prayer-grid">{prayerOrder.map(name=>{const adhan=parseTime(timings[name]),iqama=addMinutes(adhan,defaultIqamaOffset[name]);return <div key={name} className={nextPrayer?.name===name?"active":""}><b>{prayerLabels[name]}</b><span>{fmt(adhan)}</span><small>إقامة تقديرية {fmt(iqama)}</small></div>})}</div>{nextPrayer&&<p className="next-prayer">القادمة: <b>{prayerLabels[nextPrayer.name]}</b> · {fmt(nextPrayer.time)}</p>}</>}</article>
    {showSadaqah&&<div className="sadaqah-back" onClick={()=>setShowSadaqah(false)}><article onClick={e=>e.stopPropagation()}><button className="sadaqah-close" onClick={()=>setShowSadaqah(false)}>×</button><span>🤲</span><h3>{tipText}</h3><small className="donation-reason">بعد إتمام {donationReason}</small><p>إن رغبت، تستطيع التصدق عبر منصة إحسان.</p><button type="button" className="ehsan-link" onClick={clickEhsan}>فتح منصة إحسان ↗</button>{ehsanThanks&&<small>جزاك الله خيرًا 🌱</small>}</article></div>}
  </section>;
}
