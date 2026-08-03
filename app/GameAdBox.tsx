"use client";
import {useEffect,useState} from "react";
import "./game-ad.css";
type Settings={enabled:boolean;title:string;body:string;cta:string;url:string};
const defaults:Settings={enabled:false,title:"مساحة إعلانية",body:"إعلان مختار لا يعيق تجربتك.",cta:"معرفة المزيد",url:"#"};
export default function GameAdBox(){const [settings,setSettings]=useState(defaults);const [closed,setClosed]=useState(false);useEffect(()=>{const load=()=>{try{setSettings({...defaults,...JSON.parse(localStorage.getItem("navixa-ad-settings")||"{}")})}catch{}};load();addEventListener("storage",load);return()=>removeEventListener("storage",load)},[]);if(!settings.enabled||closed)return null;return <aside className="game-ad" dir="rtl"><button aria-label="إغلاق الإعلان" onClick={()=>setClosed(true)}>×</button><small>إعلان</small><b>{settings.title}</b><p>{settings.body}</p><a href={settings.url} target="_blank" rel="noreferrer">{settings.cta}</a></aside>}
