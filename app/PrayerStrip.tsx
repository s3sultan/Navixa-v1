"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {getAdminMessages,isScreenEnabled,sendTelegramAlert} from "./alertPrefs";
import {RIYADH,addMinutes,applyAdjustments,cleanTime,defaultIqamaOffset,diffMinutes,parseTime,prayerApiUrl,prayerLabels,prayerOrder,readAdjustments,saveAdjustments,todayKey,to24,type PrayerAdjustments,type PrayerName,type Timings} from "./prayerTimeModel";

const fmt12=(hhmm:string)=>parseTime(hhmm).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true});
const readJson=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch{return fallback}};

type StoredLocation={lat:number;lng:number;label?:string;source?:"device"|"fallback"};

export default function PrayerStrip(){
  const [baseTimings,setBaseTimings]=useState<Timings|null>(null);
  const [timings,setTimings]=useState<Timings|null>(null);
  const [iqamaManual,setIqamaManual]=useState<Record<string,string>|null>(null);
  const [editing,setEditing]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [alertInfo,setAlertInfo]=useState<{type:"adhan"|"iqama";name:PrayerName}|null>(null);
  const [now,setNow]=useState(new Date());
  const [location,setLocation]=useState<StoredLocation|null>(null);
  const [locationStatus,setLocationStatus]=useState("جاري تحديد المواقيت…");
  const audioRef=useRef<AudioContext|null>(null);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(!expanded)return;const t=setTimeout(()=>setExpanded(false),9000);return()=>clearTimeout(t)},[expanded]);

  const loadTimings=async(loc:StoredLocation,force=false)=>{
    const cacheKey=`navixa-prayer-cache-v2-${todayKey()}-${loc.lat.toFixed(2)}-${loc.lng.toFixed(2)}`;
    const cached=!force?readJson<Timings|null>(cacheKey,null):null;
    if(cached){const adjusted=applyAdjustments(cached,readAdjustments());setBaseTimings(cached);setTimings(adjusted);setLocationStatus(loc.source==="fallback"?"الرياض افتراضيًا · تقويم أم القرى":"موقعك · تقويم أم القرى");return}
    try{
      const r=await fetch(prayerApiUrl(loc),{cache:"no-store"});const d=await r.json();
      if(!r.ok||!d?.data?.timings)throw new Error("timings");
      localStorage.setItem(cacheKey,JSON.stringify(d.data.timings));
      const adjusted=applyAdjustments(d.data.timings,readAdjustments());setBaseTimings(d.data.timings);setTimings(adjusted);
      setLocationStatus(loc.source==="fallback"?"الرياض افتراضيًا · تقويم أم القرى":"موقعك · تقويم أم القرى");
    }catch{setLocationStatus("تعذر تحديث المواقيت الآن")}
  };

  useEffect(()=>{
    setIqamaManual(readJson("navixa-iqama-manual",null));
    const saved=readJson<StoredLocation|null>("navixa-prayer-location-v2",null);
    const apply=(loc:StoredLocation)=>{setLocation(loc);localStorage.setItem("navixa-prayer-location-v2",JSON.stringify(loc));void loadTimings(loc)};
    if(saved){apply(saved);return}
    if(typeof navigator!=="undefined"&&navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>apply({lat:pos.coords.latitude,lng:pos.coords.longitude,source:"device"}),()=>apply({...RIYADH,source:"fallback"}),{enableHighAccuracy:false,timeout:8000,maximumAge:6*60*60*1000});
    }else apply({...RIYADH,source:"fallback"});
  },[]);

  useEffect(()=>{if(!location)return;const id=setInterval(()=>void loadTimings(location,true),6*60*60*1000);return()=>clearInterval(id)},[location]);

  const iqamaTime=(name:PrayerName)=>iqamaManual?.[name]||(!timings?"":to24(addMinutes(parseTime(timings[name]),defaultIqamaOffset[name])));
  const playChime=()=>{try{const AudioCtx=(window as any).AudioContext||(window as any).webkitAudioContext;const ctx=audioRef.current||new AudioCtx();audioRef.current=ctx;[523,659,784,1046].forEach((freq,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.22;osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.18,start+.03);gain.gain.exponentialRampToValueAtTime(.001,start+.5);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.55)})}catch{}};
  const notifySystem=(type:"adhan"|"iqama",name:PrayerName)=>{const title=type==="adhan"?`حان أذان ${prayerLabels[name]}`:`حانت إقامة ${prayerLabels[name]}`;if("Notification" in window&&Notification.permission==="granted")new Notification(title,{body:"تنبيه NAVIXA للصلاة"});const previous=document.title;document.title=`${title} · NAVIXA`;setTimeout(()=>{document.title=previous},6000)};

  useEffect(()=>{if(!timings)return;const check=()=>{const hhmm=to24(new Date());prayerOrder.forEach(name=>{const adhanKey=`navixa-alerted-adhan-${todayKey()}-${name}`,iqamaKey=`navixa-alerted-iqama-${todayKey()}-${name}`;if(cleanTime(timings[name])===hhmm&&!localStorage.getItem(adhanKey)){localStorage.setItem(adhanKey,"1");if(isScreenEnabled("adhan")){setAlertInfo({type:"adhan",name});playChime();notifySystem("adhan",name)}sendTelegramAlert("adhan",`🕌 حان الآن أذان ${prayerLabels[name]} · ${fmt12(timings[name])}`)}if(iqamaTime(name)===hhmm&&!localStorage.getItem(iqamaKey)){localStorage.setItem(iqamaKey,"1");if(isScreenEnabled("iqama")){setAlertInfo({type:"iqama",name});playChime();notifySystem("iqama",name)}sendTelegramAlert("iqama",`🕌 حانت الآن إقامة ${prayerLabels[name]} · ${fmt12(iqamaTime(name))}`)}})};check();const timer=setInterval(check,10000);return()=>clearInterval(timer)},[timings,iqamaManual]);

  const openEdit=()=>{const next:Record<string,string>={};prayerOrder.forEach(name=>{next[name]=cleanTime(timings?.[name])||"";next[`iqama_${name}`]=iqamaTime(name)});setDraft(next);setEditing(true)};
  const saveEdit=()=>{if(!baseTimings)return;const adjustments:PrayerAdjustments={};const manualIqama:Record<string,string>={};prayerOrder.forEach(name=>{if(draft[name])adjustments[name]=diffMinutes(draft[name],baseTimings[name]);if(draft[`iqama_${name}`])manualIqama[name]=draft[`iqama_${name}`]});saveAdjustments(adjustments);localStorage.setItem("navixa-iqama-manual",JSON.stringify(manualIqama));setTimings(applyAdjustments(baseTimings,adjustments));setIqamaManual(manualIqama);setEditing(false)};
  const useMyLocation=()=>{if(!navigator.geolocation){setLocationStatus("المتصفح لا يدعم تحديد الموقع");return}setLocationStatus("جارٍ طلب إذن الموقع…");navigator.geolocation.getCurrentPosition(pos=>{const loc:StoredLocation={lat:pos.coords.latitude,lng:pos.coords.longitude,source:"device"};setLocation(loc);localStorage.setItem("navixa-prayer-location-v2",JSON.stringify(loc));void loadTimings(loc,true)},error=>{setLocationStatus(error.code===1?"إذن الموقع مرفوض من المتصفح · فعّله للموقع ثم حاول":"تعذر تحديد الموقع · سنستخدم الرياض مؤقتًا")},{enableHighAccuracy:true,timeout:12000,maximumAge:0})};

  const formatRemain=(ms:number)=>{const totalSec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60),s=totalSec%60;return h>0?`${h}س ${String(m).padStart(2,"0")}د`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`};
  const nextTarget=(()=>{if(!timings)return null;const events=prayerOrder.map(name=>({name,adhan:parseTime(timings[name]),iqama:parseTime(iqamaTime(name))}));let target=events.find(e=>now<e.iqama);if(!target)target={...events[0],adhan:addMinutes(events[0].adhan,1440),iqama:addMinutes(events[0].iqama,1440)};const phase:"adhan"|"iqama"=now<target.adhan?"adhan":"iqama",phaseEnd=phase==="adhan"?target.adhan:target.iqama,phaseStart=phase==="adhan"?addMinutes(phaseEnd,-180):target.adhan,totalMs=Math.max(1,phaseEnd.getTime()-phaseStart.getTime()),elapsedMs=Math.min(totalMs,Math.max(0,now.getTime()-phaseStart.getTime()));return {name:target.name,phase,progress:Math.round(elapsedMs/totalMs*100),remainMs:Math.max(0,phaseEnd.getTime()-now.getTime())}})();

  if(!timings)return <div className="prayer-strip prayer-strip-loading">{locationStatus}</div>;
  return <div className={`prayer-strip ${expanded?"is-expanded":""}`}>
    <button type="button" className="prayer-mobile-current" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><div><small>{nextTarget?.phase==="iqama"?"الإقامة القادمة":"الأذان القادم"}</small><b>{nextTarget?prayerLabels[nextTarget.name]:"الصلاة"}</b></div><div><small>المتبقي</small><strong>{nextTarget?formatRemain(nextTarget.remainMs):"—"}</strong></div></button>
    {expanded&&<div className="prayer-strip-list"><div className="prayer-location-row"><span>{locationStatus}</span><button type="button" onClick={useMyLocation}>📍 تحديث موقعي</button></div>{prayerOrder.map(name=><div key={name}><b>{prayerLabels[name]}</b><span>{fmt12(timings[name])}</span><small>إقامة {fmt12(iqamaTime(name))}</small></div>)}</div>}
    {nextTarget&&<div className="prayer-strip-next"><small>{nextTarget.phase==="adhan"?"الأذان القادم":"الإقامة القادمة"} · {prayerLabels[nextTarget.name]}</small><b>{formatRemain(nextTarget.remainMs)}</b><span className="prayer-progress"><i style={{width:`${nextTarget.progress}%`}}/></span></div>}
    <button type="button" className="prayer-strip-edit" onClick={openEdit} aria-label="تعديل مواقيت الصلاة">✎</button>
    {editing&&typeof document!=="undefined"&&createPortal(<div className="prayer-edit-back" onClick={()=>setEditing(false)}><article onClick={e=>e.stopPropagation()}><h3>ضبط المواقيت</h3><p className="prayer-edit-note">التعديل يحفظ كفرق دقائق عن تقويم أم القرى، لذلك يستمر الوقت بالتغيّر طبيعيًا يومًا بعد يوم بدل أن يبقى رقمًا ثابتًا.</p><div className="prayer-edit-grid">{prayerOrder.map(name=><div key={name}><b>{prayerLabels[name]}</b><label>أذان <input type="time" value={draft[name]||""} onChange={e=>setDraft({...draft,[name]:e.target.value})}/></label><label>إقامة <input type="time" value={draft[`iqama_${name}`]||""} onChange={e=>setDraft({...draft,[`iqama_${name}`]:e.target.value})}/></label></div>)}</div><div className="prayer-edit-actions"><button type="button" onClick={saveEdit}>حفظ الضبط الذكي</button><button type="button" className="ghost" onClick={()=>setEditing(false)}>إلغاء</button></div></article></div>,document.body)}
    {alertInfo&&<div className="adhan-alert-back" onClick={()=>setAlertInfo(null)}><article className={`adhan-alert-card is-${alertInfo.type}`} onClick={e=>e.stopPropagation()}><button type="button" className="adhan-alert-close" onClick={()=>setAlertInfo(null)}>×</button><div className="adhan-alert-photo"><img src="/navixa-mosque-prayer.jpg" alt="مسجد وقت الصلاة"/><span className="adhan-alert-photo-shade"/></div><div className="adhan-alert-copy"><small>{alertInfo.type==="adhan"?"وقت الأذان":"تنبيه الإقامة"}</small><h3>صلاة {prayerLabels[alertInfo.name]}</h3><p>{getAdminMessages()[alertInfo.type]||"حَيَّ عَلَى الصَّلَاةِ، حَيَّ عَلَى الْفَلَاحِ"}</p></div><button type="button" className="adhan-alert-confirm" onClick={()=>setAlertInfo(null)}>تم، جزاك الله خيرًا</button></article></div>}
  </div>;
}
