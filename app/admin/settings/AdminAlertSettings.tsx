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
  return <section className="panel alert-settings-panel admin-alert-settings">
    <div className="panel-head alert-settings-head"><div><small>التنبيهات والتلقرام</small><h2>سياسة التنبيهات لكل ميزة</h2></div><button onClick={save}>{saved?"تم الحفظ":"حفظ الكل"}</button></div>
    <div className="alert-settings-table">{ALERT_TYPES.map(type=><div key={type} className="alert-settings-row">
      <div className="alert-feature-title"><b>{ALERT_LABELS[type]}</b><small>حدد طريقة الإرسال المناسبة لهذه الميزة</small></div>
      <div className="alert-channel-card"><small>شاشة NAVIXA</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-screen`} checked={policy[type].screen===value} onChange={()=>updatePolicy(type,"screen",value)}/><span>{label}</span></label>)}</div></div>
      <div className="alert-channel-card"><small>تلقرام</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-telegram`} checked={policy[type].telegram===value} onChange={()=>updatePolicy(type,"telegram",value)}/><span>{label}</span></label>)}</div></div>
      <label className="admin-field alert-message-field"><small>نص مخصص اختياري</small><input className="alert-message-input" placeholder="اتركه فارغًا لاستخدام النص الافتراضي" value={messages[type]||""} onChange={e=>setMessages({...messages,[type]:e.target.value})}/></label>
    </div>)}</div>
  </section>
}
