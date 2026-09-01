"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {isScreenEnabled,sendTelegramAlert,getAdminMessages} from "./alertPrefs";

const prayerLabels:Record<string,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const prayerOrder=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const defaultOffset:Record<string,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
const RIYADH={lat:24.7136,lng:46.6753};
const today=()=>new Date().toISOString().slice(0,10);
const cleanTime=(value?:string)=>value?value.split(" ")[0]:"";
const parseToday=(hhmm:string)=>{const [h,m]=cleanTime(hhmm).split(":").map(Number);const d=new Date();if(Number.isFinite(h)&&Number.isFinite(m))d.setHours(h,m,0,0);return d};
const addMinutes=(date:Date,minutes:number)=>new Date(date.getTime()+minutes*60000);
const to24=(date:Date)=>`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const fmt12=(hhmm:string)=>{const d=parseToday(hhmm);return d.toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit",hour12:true})};

export default function PrayerStrip(){
  const [timings,setTimings]=useState<Record<string,string>|null>(null);
  const [iqamaManual,setIqamaManual]=useState<Record<string,string>|null>(null);
  const [editing,setEditing]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [alertInfo,setAlertInfo]=useState<{type:"adhan"|"iqama";name:string}|null>(null);
  const [now,setNow]=useState(new Date());
  const audioRef=useRef<AudioContext|null>(null);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(!expanded)return;const t=setTimeout(()=>setExpanded(false),7000);return()=>clearTimeout(t)},[expanded]);

  useEffect(()=>{
    const manual=JSON.parse(localStorage.getItem("navixa-prayer-manual")||"null");
    setIqamaManual(JSON.parse(localStorage.getItem("navixa-iqama-manual")||"null"));
    if(manual){setTimings(manual);return}
    const cacheKey=`navixa-prayer-cache-${today()}`;
    const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
    if(cached){setTimings(cached);return}
    let loc=JSON.parse(localStorage.getItem("navixa-prayer-location")||"null");
    if(!loc){loc=RIYADH;localStorage.setItem("navixa-prayer-location",JSON.stringify(loc))}
    fetch(`/api/prayer-times?lat=${loc.lat}&lng=${loc.lng}`).then(r=>r.json()).then(d=>{
      if(d?.data?.timings){setTimings(d.data.timings);localStorage.setItem(cacheKey,JSON.stringify(d.data.timings))}
    }).catch(()=>{});
  },[]);

  const iqamaTime=(name:string)=>{
    if(iqamaManual?.[name])return iqamaManual[name];
    if(!timings)return "";
    return to24(addMinutes(parseToday(timings[name]),defaultOffset[name]));
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
  },[timings,iqamaManual]);

  const openEdit=()=>{
    const next:Record<string,string>={};
    prayerOrder.forEach(name=>{next[name]=cleanTime(timings?.[name])||"";next[`iqama_${name}`]=iqamaTime(name)});
    setDraft(next);setEditing(true);
  };
  const saveEdit=()=>{
    const manualTimings:Record<string,string>={},manualIqama:Record<string,string>={};
    prayerOrder.forEach(name=>{if(draft[name])manualTimings[name]=draft[name];if(draft[`iqama_${name}`])manualIqama[name]=draft[`iqama_${name}`]});
    localStorage.setItem("navixa-prayer-manual",JSON.stringify(manualTimings));
    localStorage.setItem("navixa-iqama-manual",JSON.stringify(manualIqama));
    setTimings(manualTimings);setIqamaManual(manualIqama);setEditing(false);
  };

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
      <h3>تعديل مواقيت الصلاة والإقامة</h3>
      <div className="prayer-edit-grid">{prayerOrder.map(name=><div key={name}><b>{prayerLabels[name]}</b>
        <label>أذان <input type="time" value={draft[name]||""} onChange={e=>setDraft({...draft,[name]:e.target.value})}/></label>
        <label>إقامة <input type="time" value={draft[`iqama_${name}`]||""} onChange={e=>setDraft({...draft,[`iqama_${name}`]:e.target.value})}/></label>
      </div>)}</div>
      <div className="prayer-edit-actions"><button type="button" onClick={saveEdit}>حفظ</button><button type="button" className="ghost" onClick={()=>setEditing(false)}>إلغاء</button></div>
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
