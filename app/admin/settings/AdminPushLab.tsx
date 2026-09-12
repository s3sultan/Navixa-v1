"use client";
import {useMemo,useState} from "react";
import {ensureNavixaPushSubscription} from "../../pushClient";

type Kind="general"|"name_heard"|"screen_watch"|"security"|"billing";
const kinds:[Kind,string][]=[["general","عام"],["name_heard","سماع الاسم"],["screen_watch","مراقبة الشاشة"],["security","أمان"],["billing","اشتراك وفوترة"]];

export default function AdminPushLab(){
  const [title,setTitle]=useState("NAVIXA · تنبيه تجريبي");
  const [body,setBody]=useState("تم سماع اسمك أثناء المحاضرة.");
  const [kind,setKind]=useState<Kind>("name_heard");
  const [accent,setAccent]=useState("#4f7cff");
  const [previewSeconds,setPreviewSeconds]=useState(8);
  const [requireInteraction,setRequireInteraction]=useState(false);
  const [silent,setSilent]=useState(false);
  const [urgency,setUrgency]=useState("high");
  const [endpoint,setEndpoint]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const previewStyle=useMemo(()=>({borderInlineStart:`5px solid ${accent}`}),[accent]);

  async function ensureSubscription(){
    setStatus("جاري تجهيز Push...");
    const subscription=await ensureNavixaPushSubscription({requestPermission:true});
    if(!subscription)throw new Error("اسمح بتنبيهات NAVIXA ثم أعد التجربة.");
    setEndpoint(subscription.endpoint);setStatus("جهاز الإدارة جاهز للاختبار 🔔");return subscription.endpoint;
  }

  async function send(){
    setBusy(true);setStatus("");
    try{
      const target=endpoint||await ensureSubscription();
      const response=await fetch("/api/admin/push-lab",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:target,kind,title,body,accentColor:accent,requireInteraction,silent,urgency,ttl:Math.max(60,previewSeconds*10),url:"/",tag:`navixa-lab-${kind}`})});
      const result=await response.json() as {ok?:boolean;error?:string};if(!response.ok)throw new Error(result.error||"تعذر الإرسال");setStatus("تم إرسال Push الحقيقي إلى هذا الجهاز 🔔");
    }catch(error){setStatus(error instanceof Error?error.message:"تعذر الاختبار");}finally{setBusy(false);}
  }

  return <section className="panel alert-settings-panel admin-push-lab">
    <div className="panel-head push-lab-head"><div><small>مختبر Push</small><h2>تجربة إشعار حقيقي على جهازك</h2></div><button type="button" onClick={send} disabled={busy}>{busy?"جاري الإرسال":"إرسال Push تجريبي"}</button></div>
    <p className="panel-intro">المعاينة في الأسفل تعرض الشكل فقط. زر الإرسال يحاول إرسال إشعار Push حقيقي لهذا الجهاز.</p>
    <div className="push-ios-help"><b>📱 على iPhone</b><span>Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية ← افتح NAVIXA من الأيقونة ← اضغط «إرسال Push تجريبي» ← اسمح بالتنبيهات.</span></div>
    <div className="operations-grid push-lab-grid">
      <div className="operations-card push-lab-editor">
        <label className="admin-field"><small>نوع التنبيه</small><select value={kind} onChange={e=>setKind(e.target.value as Kind)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-field"><small>العنوان</small><input className="alert-message-input" value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="admin-field"><small>النص</small><textarea className="alert-message-input" value={body} maxLength={240} rows={3} onChange={e=>setBody(e.target.value)}/></label>
        <div className="push-lab-controls"><label className="admin-field color-field"><small>لون المعاينة</small><input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/></label><label className="admin-field range-field"><small>وقت المعاينة: {previewSeconds} ث</small><input type="range" min="3" max="30" value={previewSeconds} onChange={e=>setPreviewSeconds(Number(e.target.value))}/></label></div>
        <div className="policy-group push-lab-toggles"><label><input type="checkbox" checked={requireInteraction} onChange={e=>setRequireInteraction(e.target.checked)}/><span>يظل ظاهرًا إذا كان النظام يدعم ذلك</span></label><label><input type="checkbox" checked={silent} onChange={e=>setSilent(e.target.checked)}/><span>صامت</span></label></div>
        <label className="admin-field"><small>الأولوية</small><select value={urgency} onChange={e=>setUrgency(e.target.value)}><option value="very-low">منخفض جدًا</option><option value="low">منخفض</option><option value="normal">عادي</option><option value="high">عالي</option></select></label>
        {status&&<p className="admin-status" role="status">{status}</p>}
      </div>
      <div className="operations-card push-lab-preview"><small>معاينة داخل NAVIXA فقط</small><div style={{...previewStyle,padding:"14px",borderRadius:"14px",background:"var(--panel,#fff)",marginTop:"10px"}}><b>{title||"NAVIXA"}</b><p>{body||"لديك تنبيه جديد"}</p><small>هذه ليست رسالة Push. هي معاينة للشكل فقط. إشعار النظام الحقيقي يظهر بعد الضغط على زر الإرسال.</small></div></div>
    </div>
  </section>;
}
