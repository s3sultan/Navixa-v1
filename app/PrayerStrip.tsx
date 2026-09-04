"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {isScreenEnabled,sendTelegramAlert,getAdminMessages} from "./alertPrefs";

const prayerLabels:Record<string,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const prayerOrder=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const defaultOffset:Record<string,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
const RIYADH={lat:24.7136,lng:46.6753,source:"default" as const};
const METHOD_OPTIONS=[
  {value:4,label:"أم القرى - مكة (الموصى به داخل السعودية)"},
  {value:3,label:"رابطة العالم الإسلامي"},
  {value:8,label:"منطقة الخليج"},
  {value:9,label:"الكويت"},
  {value:10,label:"قطر"},
] as const;
const LOCATION_KEY="navixa-prayer-location";
const METHOD_KEY="navixa-prayer-method";
const CALIBRATION_KEY="navixa-prayer-calibration-v2";
const LEGACY_PRAYER_KEY="navixa-prayer-manual";
const LEGACY_IQAMA_KEY="navixa-iqama-manual";

type PrayerLocation={lat:number;lng:number;source:"device"|"default"};
type PrayerCalibration={version:2;adhanOffsets:Record<string,number>;iqamaDelays:Record<string,number>;anchorDate:string};

const cleanTime=(value?:string)=>value?value.split(" ")[0]:"";
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const apiDate=(date:Date)=>`${String(date.getDate()).padStart(2,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${date.getFullYear()}`;
const today=()=>dateKey(new Date());
const parseToday=(hhmm:string)=>{const [h,m]=cleanTime(hhmm).split(":").map(Number);const d=new Date();if(Number.isFinite(h)&&Number.isFinite(m))d.setHours(h,m,0,0);return d};
const addMinutes=(date:Date,minutes:number)=>new Date(date.getTime()+minutes*60000);
const to24=(date:Date)=>`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const fmt12=(hhmm:string)=>{const d=parseToday(hhmm);return d.toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit",hour12:true})};
const minuteValue=(hhmm:string)=>{const [h,m]=cleanTime(hhmm).split(":").map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null};
const shiftClock=(hhmm:string,minutes:number)=>{const value=minuteValue(hhmm);if(value===null)return cleanTime(hhmm);const shifted=(value+minutes+1440*2)%1440;return `${String(Math.floor(shifted/60)).padStart(2,"0")}:${String(shifted%60).padStart(2,"0")}`};
const clockDifference=(target:string,base:string)=>{const targetMinutes=minuteValue(target),baseMinutes=minuteValue(base);if(targetMinutes===null||baseMinutes===null)return 0;let diff=targetMinutes-baseMinutes;if(diff>720)diff-=1440;if(diff<-720)diff+=1440;return Math.max(-180,Math.min(180,diff))};
const iqamaDelay=(adhan:string,iqama:string,fallback:number)=>{const adhanMinutes=minuteValue(adhan),iqamaMinutes=minuteValue(iqama);if(adhanMinutes===null||iqamaMinutes===null)return fallback;const diff=(iqamaMinutes-adhanMinutes+1440)%1440;return diff>=0&&diff<=180?diff:fallback};
const readJson=<T,>(key:string):T|null=>{try{return JSON.parse(localStorage.getItem(key)||"null") as T|null}catch{return null}};
const validLocation=(value:unknown):value is PrayerLocation=>Boolean(value&&typeof value==="object"&&Number.isFinite((value as PrayerLocation).lat)&&Number.isFinite((value as PrayerLocation).lng)&&Math.abs((value as PrayerLocation).lat)<=90&&Math.abs((value as PrayerLocation).lng)<=180);
const applyCalibration=(base:Record<string,string>,calibration:PrayerCalibration|null)=>Object.fromEntries(Object.entries(base).map(([name,value])=>[name,prayerOrder.includes(name)?shiftClock(value,calibration?.adhanOffsets?.[name]||0):value])) as Record<string,string>;
const deriveCalibration=(base:Record<string,string>,manual:Record<string,string>,legacyIqama:Record<string,string>|null):PrayerCalibration=>{
  const adhanOffsets:Record<string,number>={},iqamaDelays:Record<string,number>={};
  prayerOrder.forEach(name=>{
    const manualAdhan=cleanTime(manual[name])||cleanTime(base[name]);
    adhanOffsets[name]=clockDifference(manualAdhan,base[name]);
    const effectiveAdhan=shiftClock(base[name],adhanOffsets[name]);
    iqamaDelays[name]=legacyIqama?.[name]?iqamaDelay(effectiveAdhan,legacyIqama[name],defaultOffset[name]):defaultOffset[name];
  });
  return {version:2,adhanOffsets,iqamaDelays,anchorDate:today()};
};

export default function PrayerStrip(){
  const [timings,setTimings]=useState<Record<string,string>|null>(null);
  const [baseTimings,setBaseTimings]=useState<Record<string,string>|null>(null);
  const [calibration,setCalibration]=useState<PrayerCalibration|null>(null);
  const [location,setLocation]=useState<PrayerLocation|null>(null);
  const [method,setMethod]=useState(4);
  const [locationStatus,setLocationStatus]=useState("");
  const [locationBusy,setLocationBusy]=useState(false);
  const [editing,setEditing]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [alertInfo,setAlertInfo]=useState<{type:"adhan"|"iqama";name:string}|null>(null);
  const [now,setNow]=useState(new Date());
  const audioRef=useRef<AudioContext|null>(null);
  const currentDay=dateKey(now);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(!expanded)return;const t=setTimeout(()=>setExpanded(false),7000);return()=>clearTimeout(t)},[expanded]);
  useEffect(()=>{
    const savedLocation=readJson<PrayerLocation>(LOCATION_KEY);
    const savedMethod=Number(localStorage.getItem(METHOD_KEY)||4);
    const savedCalibration=readJson<PrayerCalibration>(CALIBRATION_KEY);
    setLocation(validLocation(savedLocation)?savedLocation:RIYADH);
    setMethod(METHOD_OPTIONS.some(option=>option.value===savedMethod)?savedMethod:4);
    if(savedCalibration?.version===2)setCalibration(savedCalibration);
  },[]);

  useEffect(()=>{
    if(!location)return;
    let cancelled=false;
    const load=async()=>{
      const cacheKey=`navixa-prayer-cache-v2-${currentDay}-${location.lat.toFixed(4)}-${location.lng.toFixed(4)}-${method}`;
      let base=readJson<Record<string,string>>(cacheKey);
      if(!base){
        try{
          const response=await fetch(`/api/prayer-times?lat=${encodeURIComponent(String(location.lat))}&lng=${encodeURIComponent(String(location.lng))}&method=${method}&date=${apiDate(now)}`,{cache:"no-store"});
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data?.data?.timings)throw new Error("fetch");
          base=data.data.timings as Record<string,string>;
          localStorage.setItem(cacheKey,JSON.stringify(base));
        }catch{if(!cancelled)setLocationStatus("تعذر تحديث مواقيت اليوم الآن؛ سنحاول عند فتح NAVIXA مجددًا.");return}
      }
      if(cancelled||!base)return;
      let activeCalibration=readJson<PrayerCalibration>(CALIBRATION_KEY);
      const legacyManual=readJson<Record<string,string>>(LEGACY_PRAYER_KEY);
      if(!activeCalibration&&legacyManual){
        activeCalibration=deriveCalibration(base,legacyManual,readJson<Record<string,string>>(LEGACY_IQAMA_KEY));
        localStorage.setItem(CALIBRATION_KEY,JSON.stringify(activeCalibration));
        localStorage.removeItem(LEGACY_PRAYER_KEY);localStorage.removeItem(LEGACY_IQAMA_KEY);
        setCalibration(activeCalibration);
        setLocationStatus("تم تحويل المواقيت اليدوية القديمة إلى ضبط يتقدم تلقائيًا كل يوم.");
      }
      setBaseTimings(base);
      setTimings(applyCalibration(base,activeCalibration));
    };
    void load();
    return()=>{cancelled=true};
  },[location?.lat,location?.lng,method,currentDay]);

  const iqamaTime=(name:string)=>{
    if(!timings)return "";
    const delay=calibration?.iqamaDelays?.[name]??defaultOffset[name];
    return to24(addMinutes(parseToday(timings[name]),delay));
  };

  const playChime=()=>{
    try{
      const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;
      const ctx=audioRef.current||new AudioCtx();audioRef.current=ctx;
      [523,659,784,1046].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();const start=ctx.currentTime+i*.22;
        osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.18,start+.03);gain.gain.exponentialRampToValueAtTime(.001,start+.5);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.55);
      });
    }catch{}
  };

  const notifySystem=(type:"adhan"|"iqama",name:string)=>{
    const title=type==="adhan"?`حان أذان ${prayerLabels[name]}`:`حانت إقامة ${prayerLabels[name]}`;
    if(typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted")new Notification(title,{body:"تنبيه NAVIXA للصلاة"});
    const previous=document.title;document.title=`${title} — NAVIXA`;setTimeout(()=>{document.title=previous},6000);
  };

  useEffect(()=>{
    if(!timings)return;
    const check=()=>{
      const hhmm=to24(new Date());
      prayerOrder.forEach(name=>{
        const adhanKey=`navixa-alerted-adhan-${today()}-${name}`,iqamaKey=`navixa-alerted-iqama-${today()}-${name}`;
        if(cleanTime(timings[name])===hhmm&&!localStorage.getItem(adhanKey)){localStorage.setItem(adhanKey,"1");if(isScreenEnabled("adhan")){setAlertInfo({type:"adhan",name});playChime();notifySystem("adhan",name)}sendTelegramAlert("adhan",`🕌 حان الآن أذان ${prayerLabels[name]} — ${fmt12(timings[name])}`)}
        if(iqamaTime(name)===hhmm&&!localStorage.getItem(iqamaKey)){localStorage.setItem(iqamaKey,"1");if(isScreenEnabled("iqama")){setAlertInfo({type:"iqama",name});playChime();notifySystem("iqama",name)}sendTelegramAlert("iqama",`🕌 حانت الآن إقامة ${prayerLabels[name]} — ${fmt12(iqamaTime(name))}`)}
      });
    };
    const timer=setInterval(check,10000);
    return()=>clearInterval(timer);
  },[timings,calibration]);

  const openEdit=()=>{
    const next:Record<string,string>={};
    prayerOrder.forEach(name=>{next[name]=cleanTime(timings?.[name])||"";next[`iqama_${name}`]=iqamaTime(name)});
    setDraft(next);setEditing(true);setLocationStatus("");
  };
  const saveEdit=()=>{
    if(!baseTimings){setLocationStatus("انتظر تحديث تقويم اليوم ثم احفظ التعديل.");return}
    const adhanOffsets:Record<string,number>={},iqamaDelays:Record<string,number>={};
    prayerOrder.forEach(name=>{
      const requestedAdhan=cleanTime(draft[name])||cleanTime(baseTimings[name]);
      adhanOffsets[name]=clockDifference(requestedAdhan,baseTimings[name]);
      const effectiveAdhan=shiftClock(baseTimings[name],adhanOffsets[name]);
      iqamaDelays[name]=iqamaDelay(effectiveAdhan,draft[`iqama_${name}`]||"",defaultOffset[name]);
    });
    const next:PrayerCalibration={version:2,adhanOffsets,iqamaDelays,anchorDate:currentDay};
    localStorage.setItem(CALIBRATION_KEY,JSON.stringify(next));
    localStorage.removeItem(LEGACY_PRAYER_KEY);localStorage.removeItem(LEGACY_IQAMA_KEY);
    setCalibration(next);setTimings(applyCalibration(baseTimings,next));setEditing(false);
    setLocationStatus("تم الحفظ كفروق على التقويم؛ ستتقدم المواقيت تلقائيًا مع تغيّر الأيام.");
  };
  const resetManual=()=>{
    localStorage.removeItem(CALIBRATION_KEY);localStorage.removeItem(LEGACY_PRAYER_KEY);localStorage.removeItem(LEGACY_IQAMA_KEY);
    setCalibration(null);if(baseTimings)setTimings(baseTimings);setLocationStatus("تم الرجوع إلى التقويم التلقائي بدون تعديل يدوي.");
  };
  const useDeviceLocation=()=>{
    if(!("geolocation" in navigator)){setLocationStatus("هذا المتصفح لا يدعم تحديد الموقع.");return}
    setLocationBusy(true);setLocationStatus("جاري طلب موقع الجهاز…");
    navigator.geolocation.getCurrentPosition(position=>{
      const next:PrayerLocation={lat:position.coords.latitude,lng:position.coords.longitude,source:"device"};
      localStorage.setItem(LOCATION_KEY,JSON.stringify(next));setLocation(next);setLocationBusy(false);setLocationStatus("تم اعتماد موقع جهازك للمواقيت. سيُحدّث NAVIXA الأوقات يوميًا.");
    },()=>{setLocationBusy(false);setLocationStatus("لم نتمكن من قراءة الموقع. اسمح للموقع من إعدادات المتصفح ثم أعد المحاولة.")},{enableHighAccuracy:false,timeout:10000,maximumAge:6*60*60*1000});
  };
  const useRiyadh=()=>{localStorage.setItem(LOCATION_KEY,JSON.stringify(RIYADH));setLocation(RIYADH);setLocationStatus("تم اعتماد الرياض كموقع افتراضي.")};
  const changeMethod=(value:number)=>{setMethod(value);localStorage.setItem(METHOD_KEY,String(value));setLocationStatus("تم تغيير طريقة الحساب وسيتم تحديث مواقيت اليوم.")};

  const formatRemain=(ms:number)=>{
    const totalSec=Math.floor(ms/1000);
    const h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60),s=totalSec%60;
    if(h>0)return `${h}س ${String(m).padStart(2,"0")}د`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const nextTarget=(()=>{
    if(!timings)return null;
    const events=prayerOrder.map(name=>({name,adhan:parseToday(timings[name]),iqama:parseToday(iqamaTime(name))}));
    let target=events.find(e=>now<e.iqama);
    if(!target)target={...events[0],adhan:addMinutes(events[0].adhan,1440),iqama:addMinutes(events[0].iqama,1440)};
    const phase:"adhan"|"iqama"=now<target.adhan?"adhan":"iqama";
    const phaseEnd=phase==="adhan"?target.adhan:target.iqama;
    const phaseStart=phase==="adhan"?addMinutes(phaseEnd,-180):target.adhan;
    const totalMs=Math.max(1,phaseEnd.getTime()-phaseStart.getTime());
    const elapsedMs=Math.min(totalMs,Math.max(0,now.getTime()-phaseStart.getTime()));
    return {name:target.name,phase,progress:Math.round((elapsedMs/totalMs)*100),remainMs:Math.max(0,phaseEnd.getTime()-now.getTime())};
  })();

  const mobileTarget=(()=>{
    if(!timings)return null;
    const events=prayerOrder.map(name=>({name,adhan:parseToday(timings[name]),iqama:parseToday(iqamaTime(name))}));
    const active=events.find(event=>now>=event.adhan&&now<event.iqama);
    if(active)return {kind:"active",name:active.name,adhan:active.adhan,iqama:active.iqama,remainMs:Math.max(0,active.iqama.getTime()-now.getTime())};
    const next=events.find(event=>event.adhan>now)||{...events[0],adhan:addMinutes(events[0].adhan,1440),iqama:addMinutes(events[0].iqama,1440)};
    return {kind:"next",name:next.name,adhan:next.adhan,iqama:next.iqama,remainMs:Math.max(0,next.adhan.getTime()-now.getTime())};
  })();
  if(!timings)return null;
  return <div className={`prayer-strip ${expanded?"is-expanded":""}`}>
    <button type="button" key={mobileTarget ? `${mobileTarget.kind}-${mobileTarget.name}` : "mobile-prayer"} className="prayer-mobile-current" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} aria-label={expanded?"إخفاء جميع مواقيت الصلاة":"عرض جميع مواقيت الصلاة"}>{mobileTarget&&<><div><small>{mobileTarget.kind==="active"?"الصلاة الحالية":"الصلاة القادمة"}</small><b>{prayerLabels[mobileTarget.name]}</b></div><div><small>{mobileTarget.kind==="active"?"الإقامة":"الأذان"}</small><strong>{fmt12(mobileTarget.kind==="active"?to24(mobileTarget.iqama):to24(mobileTarget.adhan))}</strong></div><div><small>المتبقي</small><strong>{formatRemain(mobileTarget.remainMs)}</strong></div></>}</button>
    {expanded&&<div className="prayer-strip-list">{prayerOrder.map(name=><div key={name}><b>{prayerLabels[name]}</b><span>{fmt12(timings[name])}</span><small>إقامة {fmt12(iqamaTime(name))}</small></div>)}</div>}
    {nextTarget&&<div className="prayer-strip-next">
      <small>{nextTarget.phase==="adhan"?"الأذان القادم":"الإقامة القادمة"} · {prayerLabels[nextTarget.name]}</small>
      <b>{formatRemain(nextTarget.remainMs)}</b>
      <span className="prayer-progress"><i style={{width:`${nextTarget.progress}%`}}/></span>
    </div>}
    <button type="button" className="prayer-strip-edit" onClick={openEdit} aria-label="تعديل مواقيت الصلاة">✎</button>

    {editing&&typeof document!=="undefined"&&createPortal(<div className="prayer-edit-back" onClick={()=>setEditing(false)}><article onClick={e=>e.stopPropagation()}>
      <h3>مواقيت الصلاة والموقع</h3>
      <div className="prayer-location-tools">
        <p><b>الموقع:</b> {location?.source==="device"?"موقع جهازك":"الرياض افتراضيًا"}. لا يتم حفظ الإحداثيات في حسابك؛ تبقى على هذا الجهاز وتُستخدم لجلب المواقيت.</p>
        <div className="prayer-edit-actions"><button type="button" onClick={useDeviceLocation} disabled={locationBusy}>{locationBusy?"جاري تحديد الموقع…":"استخدام موقعي الحالي"}</button><button type="button" className="ghost" onClick={useRiyadh}>استخدام الرياض</button></div>
        <label>طريقة الحساب <select value={method} onChange={e=>changeMethod(Number(e.target.value))}>{METHOD_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {locationStatus&&<p role="status">{locationStatus}</p>}
      </div>
      <p>أي وقت تعدله يدويًا يُحفظ الآن كفرق دقائق فوق التقويم، وليس كساعة ثابتة. لذلك يتغير تلقائيًا من يوم لليوم.</p>
      <div className="prayer-edit-grid">{prayerOrder.map(name=><div key={name}><b>{prayerLabels[name]}</b>
        <label>أذان <input type="time" value={draft[name]||""} onChange={e=>setDraft({...draft,[name]:e.target.value})}/></label>
        <label>إقامة <input type="time" value={draft[`iqama_${name}`]||""} onChange={e=>setDraft({...draft,[`iqama_${name}`]:e.target.value})}/></label>
      </div>)}</div>
      <div className="prayer-edit-actions"><button type="button" onClick={saveEdit}>حفظ ذكي</button><button type="button" className="ghost" onClick={resetManual}>الرجوع للتلقائي</button><button type="button" className="ghost" onClick={()=>setEditing(false)}>إلغاء</button></div>
    </article></div>,document.body)}

    {alertInfo&&<div className="adhan-alert-back" role="presentation" onClick={()=>setAlertInfo(null)}><article className={`adhan-alert-card is-${alertInfo.type}`} role="dialog" aria-modal="true" aria-labelledby="adhan-alert-title" onClick={e=>e.stopPropagation()}>
      <button type="button" className="adhan-alert-close" onClick={()=>setAlertInfo(null)} aria-label="إغلاق التنبيه">×</button>
      <div className="adhan-alert-photo"><img src="/navixa-mosque-prayer.jpg" alt="مسجد مضاء وقت الغروب"/><span className="adhan-alert-photo-shade"/></div>
      <div className="adhan-alert-copy"><small><i>◌</i>{alertInfo.type==="adhan"?"وقت الأذان":"تنبيه الإقامة"}</small>
      <h3 id="adhan-alert-title">صلاة {prayerLabels[alertInfo.name]}</h3>
      <p>{getAdminMessages()[alertInfo.type]||"حَيَّ عَلَى الصَّلَاةِ، حَيَّ عَلَى الْفَلَاحِ — اترك ما بيدك والحق بالصلاة."}</p></div>
      <button type="button" className="adhan-alert-confirm" onClick={()=>setAlertInfo(null)}>تم، جزاك الله خيرًا</button>
    </article></div>}
  </div>
}
