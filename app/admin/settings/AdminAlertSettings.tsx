"use client";
import {useEffect,useState} from "react";
import {ALERT_TYPES,ALERT_LABELS,AlertType,Policy,getAdminPolicy,setAdminPolicy,getAdminMessages,setAdminMessages} from "../../alertPrefs";

const policyLabels:[Policy,string][]=[["on","تشغيل للجميع"],["off","إيقاف للجميع"],["user","حسب اختيار المستخدم"]];
type PolicyMap=Record<AlertType,{screen:Policy;telegram:Policy}>;

export default function AdminAlertSettings(){
  const [policy,setPolicy]=useState<PolicyMap|null>(null);
  const [messages,setMessages]=useState<Partial<Record<AlertType,string>>>({});
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const response=await fetch("/api/admin/alert-policy",{cache:"no-store"});
        const data=await response.json().catch(()=>({})) as {policy?:PolicyMap;messages?:Partial<Record<AlertType,string>>};
        if(active&&response.ok&&data.policy){setPolicy(data.policy);setMessages(data.messages||{});setAdminPolicy(data.policy);setAdminMessages(data.messages||{});return}
      }catch{}
      if(active){setPolicy(getAdminPolicy());setMessages(getAdminMessages());setStatus("تعذر قراءة السياسة المركزية؛ المعروض نسخة محلية مؤقتة.")}
    };
    void load();return()=>{active=false};
  },[]);

  const updatePolicy=(type:AlertType,channel:"screen"|"telegram",value:Policy)=>{
    if(!policy)return;
    setPolicy({...policy,[type]:{...policy[type],[channel]:value}});
  };
  const setAll=(value:Policy)=>{
    if(!policy)return;
    const next=Object.fromEntries(ALERT_TYPES.map(type=>[type,{screen:value,telegram:value}])) as PolicyMap;
    setPolicy(next);setStatus(value==="on"?"تم تجهيز تشغيل جميع التنبيهات لكل المستخدمين. اضغط حفظ الكل لاعتمادها.":value==="off"?"تم تجهيز إيقاف جميع التنبيهات. اضغط حفظ الكل لاعتمادها.":"تم تجهيز إعادة التحكم للمستخدمين. اضغط حفظ الكل لاعتمادها.");
  };
  const save=async()=>{
    if(!policy||busy)return;
    setBusy(true);setStatus("");
    try{
      const response=await fetch("/api/admin/alert-policy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({policy,messages})});
      const data=await response.json().catch(()=>({})) as {error?:string;policy?:PolicyMap;messages?:Partial<Record<AlertType,string>>};
      if(!response.ok)throw new Error(data.error||"تعذر الحفظ");
      const savedPolicy=data.policy||policy,savedMessages=data.messages||messages;
      setPolicy(savedPolicy);setMessages(savedMessages);setAdminPolicy(savedPolicy);setAdminMessages(savedMessages);setStatus("تم حفظ سياسة التنبيهات مركزيًا لجميع المستخدمين.");
    }catch(error){setStatus(error instanceof Error?error.message:"تعذر حفظ سياسة التنبيهات")}finally{setBusy(false)}
  };

  if(!policy)return null;
  return <section className="panel alert-settings-panel admin-alert-settings">
    <div className="panel-head alert-settings-head"><div><small>التنبيهات والتلقرام</small><h2>سياسة التنبيهات لكل ميزة</h2><p>هذه السياسة الآن مركزية وليست مرتبطة بجهاز المدير فقط.</p></div><button onClick={save} disabled={busy}>{busy?"جاري الحفظ…":"حفظ الكل"}</button></div>
    <div className="admin-actions"><button type="button" onClick={()=>setAll("on")}>تشغيل جميع التنبيهات</button><button type="button" onClick={()=>setAll("user")}>حسب اختيار المستخدم للجميع</button><button type="button" onClick={()=>setAll("off")}>إيقاف الجميع</button></div>
    {status&&<p className="admin-status" role="status">{status}</p>}
    <div className="alert-settings-table">{ALERT_TYPES.map(type=><div key={type} className="alert-settings-row">
      <div className="alert-feature-title"><b>{ALERT_LABELS[type]}</b><small>حدد طريقة الإرسال المناسبة لهذه الميزة</small></div>
      <div className="alert-channel-card"><small>شاشة NAVIXA</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-screen`} checked={policy[type].screen===value} onChange={()=>updatePolicy(type,"screen",value)}/><span>{label}</span></label>)}</div></div>
      <div className="alert-channel-card"><small>تلقرام</small><div className="policy-group">{policyLabels.map(([value,label])=><label key={value}><input type="radio" name={`${type}-telegram`} checked={policy[type].telegram===value} onChange={()=>updatePolicy(type,"telegram",value)}/><span>{label}</span></label>)}</div></div>
      <label className="admin-field alert-message-field"><small>نص مخصص اختياري</small><input className="alert-message-input" placeholder="اتركه فارغًا لاستخدام النص الافتراضي" value={messages[type]||""} maxLength={240} onChange={e=>setMessages({...messages,[type]:e.target.value})}/></label>
    </div>)}</div>
  </section>
}
