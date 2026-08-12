"use client";
import {useEffect,useState} from "react";
import {ALERT_TYPES,ALERT_LABELS,AlertType,Policy,getAdminPolicy,setAdminPolicy,getAdminMessages,setAdminMessages} from "../../alertPrefs";

const policyLabels:[Policy,string][]=[["on","تشغيل للجميع"],["off","إيقاف للجميع"],["user","حسب اختيار المستخدم"]];

export default function AdminAlertSettings(){
  const [policy,setPolicy]=useState<Record<AlertType,{screen:Policy;telegram:Policy}>|null>(null);
  const [messages,setMessages]=useState<Partial<Record<AlertType,string>>>({});
  const [saved,setSaved]=useState(false);

  useEffect(()=>{setPolicy(getAdminPolicy());setMessages(getAdminMessages())},[]);

  const updatePolicy=(type:AlertType,channel:"screen"|"telegram",value:Policy)=>{
    if(!policy)return;
    setPolicy({...policy,[type]:{...policy[type],[channel]:value}});
  };
  const save=()=>{
    if(policy)setAdminPolicy(policy);
    setAdminMessages(messages);
    setSaved(true);setTimeout(()=>setSaved(false),1500);
  };

  if(!policy)return null;
  return <section className="panel alert-settings-panel">
    <div className="panel-head"><div><small>التنبيهات والتلقرام</small><h2>سياسة التنبيهات لكل ميزة</h2></div><button onClick={save}>{saved?"تم الحفظ":"حفظ الكل"}</button></div>
    <div className="alert-settings-table">{ALERT_TYPES.map(type=><div key={type} className="alert-settings-row">
      <b>{ALERT_LABELS[type]}</b>
      <div><small>شاشة</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-screen`} checked={policy[type].screen===value} onChange={()=>updatePolicy(type,"screen",value)}/>{label}</label>)}</div></div>
      <div><small>تلقرام</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-telegram`} checked={policy[type].telegram===value} onChange={()=>updatePolicy(type,"telegram",value)}/>{label}</label>)}</div></div>
      <input className="alert-message-input" placeholder="نص الرسالة (اختياري)" value={messages[type]||""} onChange={e=>setMessages({...messages,[type]:e.target.value})}/>
    </div>)}</div>
  </section>
}
