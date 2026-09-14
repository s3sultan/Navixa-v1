"use client";
import {useMemo,useState} from "react";
import {ensureNavixaPushSubscription} from "../../pushClient";

type Kind="general"|"name_heard"|"screen_watch"|"security"|"billing";
type PriorityMode="auto"|"low"|"normal"|"important"|"critical";
type UrgencyMode="auto"|"very-low"|"low"|"normal"|"high";
type InteractionMode="auto"|"on"|"off";
const kinds:[Kind,string][]=[["general","عام"],["name_heard","سماع الاسم"],["screen_watch","مراقبة الشاشة"],["security","أمان"],["billing","اشتراك وفوترة"]];
const priorityLabels:Record<PriorityMode,string>={auto:"تلقائية حسب نوع التنبيه",low:"منخفضة",normal:"عادية",important:"مهمة",critical:"حرجة"};

export default function AdminPushLab(){
  const [title,setTitle]=useState("NAVIXA · تم سماع اسمك");
  const [body,setBody]=useState("تم سماع اسمك أثناء المحاضرة. اضغط لفتح NAVIXA.");
  const [kind,setKind]=useState<Kind>("name_heard");
  const [accent,setAccent]=useState("#4f7cff");
  const [priority,setPriority]=useState<PriorityMode>("auto");
  const [urgency,setUrgency]=useState<UrgencyMode>("auto");
  const [interaction,setInteraction]=useState<InteractionMode>("auto");
  const [quickActions,setQuickActions]=useState(true);
  const [silent,setSilent]=useState(false);
  const [endpoint,setEndpoint]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const previewStyle=useMemo(()=>({borderInlineStart:`5px solid ${accent}`}),[accent]);

  async function ensureSubscription(){
    setStatus("جاري تجهيز Push...");
    const subscription=await ensureNavixaPushSubscription({requestPermission:true});
    if(!subscription)throw new Error("اسمح بتنبيهات NAVIXA ثم أعد التجربة.");
    setEndpoint(subscription.endpoint);setStatus("جهاز الإدارة جاهز للاختبار.");return subscription.endpoint;
  }

  async function send(){
    setBusy(true);setStatus("");
    try{
      const target=endpoint||await ensureSubscription();
      const payload={
        endpoint:target,
        kind,
        title,
        body,
        accentColor:accent,
        silent,
        url:"/",
        tag:`navixa-lab-${kind}`,
        ...(priority!=="auto"?{priority}:{}),
        ...(urgency!=="auto"?{urgency}:{}),
        ...(interaction!=="auto"?{requireInteraction:interaction==="on"}:{}),
        actions:quickActions?[{action:"open",title:"فتح NAVIXA",url:"/"},{action:"dismiss",title:"تم"}]:[],
      };
      const response=await fetch("/api/admin/push-lab",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok)throw new Error(result.error||"تعذر الإرسال");
      setStatus("تم إرسال Push الحقيقي. إذا كانت إشعارات NAVIXA مسموحة على Apple Watch المقترنة فسيظهر التنبيه عليها وفق إعدادات النظام.");
    }catch(error){setStatus(error instanceof Error?error.message:"تعذر الاختبار");}finally{setBusy(false);}
  }

  return <section className="panel alert-settings-panel admin-push-lab">
    <div className="panel-head push-lab-head"><div><small>مختبر Push</small><h2>تجربة إشعار حقيقي على الجهاز والساعة المقترنة</h2></div><button type="button" onClick={send} disabled={busy}>{busy?"جاري الإرسال":"إرسال Push تجريبي"}</button></div>
    <p className="panel-intro">الأولوية التلقائية تختار سلوك الإرسال حسب نوع التنبيه. الأزرار السريعة تحسين إضافي؛ إذا لم يدعمها الجهاز يبقى الضغط على التنبيه نفسه هو المسار الأساسي.</p>
    <div className="push-ios-help"><b>iPhone + Apple Watch</b><span>ثبّت NAVIXA من Safari على الشاشة الرئيسية وافتحه من الأيقونة ثم اسمح بالإشعارات. إشعارات تطبيق الويب يمكن أن تظهر على Apple Watch المقترنة وفق إعدادات إشعارات النظام.</span></div>
    <div className="operations-grid push-lab-grid">
      <div className="operations-card push-lab-editor">
        <label className="admin-field"><small>نوع التنبيه</small><select value={kind} onChange={e=>setKind(e.target.value as Kind)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-field"><small>العنوان</small><input className="alert-message-input" value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="admin-field"><small>النص</small><textarea className="alert-message-input" value={body} maxLength={240} rows={3} onChange={e=>setBody(e.target.value)}/></label>
        <label className="admin-field color-field"><small>لون المعاينة</small><input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/></label>
        <label className="admin-field"><small>أولوية NAVIXA</small><select value={priority} onChange={e=>setPriority(e.target.value as PriorityMode)}><option value="auto">تلقائية حسب النوع</option><option value="low">منخفضة</option><option value="normal">عادية</option><option value="important">مهمة</option><option value="critical">حرجة</option></select></label>
        <label className="admin-field"><small>بقاء التنبيه</small><select value={interaction} onChange={e=>setInteraction(e.target.value as InteractionMode)}><option value="auto">تلقائي حسب الأولوية</option><option value="on">يبقى ظاهرًا إذا دعمه النظام</option><option value="off">لا يطلب البقاء</option></select></label>
        <label className="admin-field"><small>Urgency للنقل</small><select value={urgency} onChange={e=>setUrgency(e.target.value as UrgencyMode)}><option value="auto">تلقائي حسب الأولوية</option><option value="very-low">منخفض جدًا</option><option value="low">منخفض</option><option value="normal">عادي</option><option value="high">عالٍ</option></select></label>
        <div className="policy-group push-lab-toggles"><label><input type="checkbox" checked={quickActions} onChange={e=>setQuickActions(e.target.checked)}/><span>إجراءات سريعة: فتح NAVIXA + تم</span></label><label><input type="checkbox" checked={silent} onChange={e=>setSilent(e.target.checked)}/><span>صامت</span></label></div>
        {status&&<p className="admin-status" role="status">{status}</p>}
      </div>
      <div className="operations-card push-lab-preview"><small>معاينة داخل NAVIXA فقط</small><div style={{...previewStyle,padding:"14px",borderRadius:"14px",background:"var(--panel,#fff)",marginTop:"10px"}}><b>{title||"NAVIXA"}</b><p>{body||"لديك تنبيه جديد"}</p><small>الأولوية: {priorityLabels[priority]} · الإجراءات: {quickActions?"فتح NAVIXA + تم":"بدون أزرار"}</small></div></div>
    </div>
  </section>;
}
