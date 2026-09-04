"use client";
import {useEffect,useState} from "react";
import {ALERT_LABELS,ALERT_TYPES,AlertType,getUserPrefs,sendTelegramMessage,setUserPrefs} from "./alertPrefs";
import {getPersonalReminderPrefs,PersonalReminderPrefs,setPersonalReminderPrefs} from "./reminderPrefs";

type Prefs=Record<AlertType,{screen:boolean;telegram:boolean}>;
type TelegramState="loading"|"unavailable"|"disconnected"|"connected";
type Props={onPreviewReminder:(message:string)=>void};

const REMINDER_STREAMS=[
  {icon:"◷",title:"دراستك ومواعيدك",detail:"اختبارات، كويزات، اجتماعات ومهام من صفحة يومي.",href:"/today"},
  {icon:"◎",title:"تركيزك وصحتك",detail:"الماء، الحركة، راحة العين وجلسات التركيز.",href:"/#focus"},
  {icon:"⌾",title:"حسابك وتجديدك",detail:"تذكير تجربة أو اشتراك هِمّة قبل الانتهاء.",href:"/account"},
  {icon:"◌",title:"منظومة NAVIXA",detail:"صلاحية Fitness وKids وLearning مرتبطة بحالة عضويتك.",href:"/portfolio"},
] as const;

export default function NotificationCenter({onPreviewReminder}:Props){
  const [prefs,setPrefs]=useState<Prefs|null>(null);
  const [telegramState,setTelegramState]=useState<TelegramState>("loading");
  const [status,setStatus]=useState("");
  const [testing,setTesting]=useState(false);
  const [reminderPrefs,setReminderPrefs]=useState<PersonalReminderPrefs|null>(null);
  const [browserPermission,setBrowserPermission]=useState<NotificationPermission|"unsupported">("unsupported");

  const loadTelegram=async()=>{const response=await fetch("/api/account/telegram/link",{cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok){setTelegramState("unavailable");return}setTelegramState(data.linked?"connected":"disconnected")};
  useEffect(()=>{setPrefs(getUserPrefs());setReminderPrefs(getPersonalReminderPrefs());setBrowserPermission("Notification" in window?Notification.permission:"unsupported");void loadTelegram()},[]);
  const linkTelegram=async()=>{setTesting(true);setStatus("");try{const response=await fetch("/api/account/telegram/link",{method:"POST"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"تعذر بدء ربط Telegram");window.open(data.link,"_blank","noopener,noreferrer");setStatus("افتح بوت NAVIXA واضغط Start لإكمال الربط، ثم عد إلى الموقع واضغط تحديث.")}catch(error){setStatus(error instanceof Error?error.message:"تعذر بدء ربط Telegram")}finally{setTesting(false)}};
  const disconnectTelegram=async()=>{setTesting(true);setStatus("");const response=await fetch("/api/account/telegram/link",{method:"DELETE"});const data=await response.json().catch(()=>({}));setTesting(false);if(!response.ok){setStatus(data.error||"تعذر فصل Telegram");return}setTelegramState("disconnected");setStatus("تم فصل بوت NAVIXA من حسابك.")};
  const test=async()=>{if(telegramState!=="connected")return;setTesting(true);setStatus("");const ok=await sendTelegramMessage("🔔 رسالة تجريبية خاصة من NAVIXA");setTesting(false);setStatus(ok?"وصل التنبيه التجريبي إلى Telegram بنجاح":"تعذر إرسال التنبيه — تحقق من حالة الربط")};
  const toggle=(type:AlertType,channel:"screen"|"telegram")=>{if(!prefs)return;const enabled=!prefs[type][channel];const next={...prefs,[type]:{...prefs[type],[channel]:enabled}};setPrefs(next);setUserPrefs(next);if(channel==="telegram"&&telegramState==="connected")void fetch("/api/account/telegram/preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type,enabled})})};
  const updateReminderPrefs=(patch:Partial<PersonalReminderPrefs>)=>{if(!reminderPrefs)return;const next={...reminderPrefs,...patch};setReminderPrefs(next);setPersonalReminderPrefs(next)};
  const requestBrowserNotifications=async()=>{if(!("Notification" in window)){setBrowserPermission("unsupported");return}const permission=await Notification.requestPermission();setBrowserPermission(permission);if(permission==="granted")updateReminderPrefs({browser:true});if(permission!=="granted")setStatus("لم تُمنح صلاحية إشعارات الجهاز؛ ستبقى التذكيرات داخل NAVIXA")};
  const previewReminder=()=>{const title="تذكير ماء لطيف",body="مر وقت منذ آخر كوب ماء مسجّل. خذ رشفة إذا احتجت.";if(reminderPrefs?.browser&&"Notification" in window&&Notification.permission==="granted")new Notification(title,{body,tag:"navixa-preview"});onPreviewReminder(`${title} — ${body}`);setStatus("ظهرت معاينة التذكير الآن")};
  const connected=telegramState==="connected";

  return <div className="notification-center">
    <div className="channel-summary"><div><span className="channel-icon">➤</span><p><small>قناة التنبيه الاختيارية</small><b>بوت NAVIXA الرسمي</b><em className={connected?"connected":""}>{connected?"● مرتبط بحسابك":telegramState==="unavailable"?"○ يتطلب حساب NAVIXA":"○ غير مرتبط"}</em></p></div>{connected&&<div className="channel-actions"><button type="button" onClick={test} disabled={testing}>{testing?"جارٍ الاختبار…":"إرسال تجربة"}</button><button type="button" className="disconnect" onClick={disconnectTelegram}>فصل</button></div>}</div>
    {!connected&&telegramState!=="loading"&&<div className="telegram-connect"><p>{telegramState==="unavailable"?"سجّل الدخول إلى حساب NAVIXA أولًا، ثم اربط البوت مرة واحدة. لن نطلب منك Bot Token أو Chat ID.":"اربط بوت NAVIXA مرة واحدة لتصل إليك تنبيهاتك أنت فقط. لا نطلب منك أي بيانات بوت شخصية."}</p>{telegramState==="unavailable"?<a href="/account">فتح حساب NAVIXA</a>:<button type="button" disabled={testing} onClick={linkTelegram}>{testing?"جارٍ فتح الرابط…":"ربط بوت NAVIXA"}</button>}<small>يمكنك فصل الربط في أي وقت من دون التأثير على تنبيهاتك داخل الموقع.</small></div>}
    {status&&<p className="channel-status" role="status">{status}</p>}
    <section className="unified-reminder-overview" aria-labelledby="unified-reminder-title"><div><small>مركز تذكيراتك الموحّد</small><h3 id="unified-reminder-title">كل ما يحتاج انتباهك، من دون تكرار أو إزعاج.</h3><p>اختر القناة التي تناسبك لكل نوع. لا يُرسل Telegram أو إشعار الجهاز إلا بعد موافقتك وربطك الصريح.</p></div><div className="unified-reminder-streams">{REMINDER_STREAMS.map(stream=><a href={stream.href} key={stream.title}><span aria-hidden="true">{stream.icon}</span><b>{stream.title}</b><small>{stream.detail}</small><em>فتح ←</em></a>)}</div></section>
    <section className="personal-reminder-settings" aria-labelledby="personal-reminders-title"><div className="personal-reminder-heading"><div><small>تذكيراتك الشخصية</small><h3 id="personal-reminders-title">تصل عندما تكون مناسبة لك</h3><p>نعتمد على آخر تفاعل وآخر كوب ماء وفترة الهدوء التي تختارها، ولا نرسل جدولًا موحّدًا للجميع.</p></div><label className="personal-reminder-switch"><input type="checkbox" checked={reminderPrefs?.enabled??false} onChange={e=>updateReminderPrefs({enabled:e.target.checked})}/><span>{reminderPrefs?.enabled?"مفعّلة":"متوقفة"}</span></label></div>{reminderPrefs&&<div className="personal-reminder-controls"><label><input type="checkbox" checked={reminderPrefs.water} onChange={e=>updateReminderPrefs({water:e.target.checked})}/> تذكير الماء</label><label><input type="checkbox" checked={reminderPrefs.break} onChange={e=>updateReminderPrefs({break:e.target.checked})}/> استراحة الحركة</label><label><input type="checkbox" checked={reminderPrefs.eye} onChange={e=>updateReminderPrefs({eye:e.target.checked})}/> راحة العين</label><label className="reminder-quiet-select">فاصل هادئ<select value={reminderPrefs.quietMinutes} onChange={e=>updateReminderPrefs({quietMinutes:Number(e.target.value)})}><option value="25">25 دقيقة</option><option value="35">35 دقيقة</option><option value="45">45 دقيقة</option><option value="60">60 دقيقة</option></select></label><button type="button" className="browser-notification-button" onClick={requestBrowserNotifications} disabled={browserPermission==="granted"}>{browserPermission==="granted"?"إشعارات الجهاز مفعّلة":"تفعيل إشعارات الجهاز"}</button><button type="button" className="personal-reminder-preview-button" onClick={previewReminder}>✦ معاينة تذكير الآن</button></div>}<small className="personal-reminder-note">تظهر التذكيرات دائمًا داخل NAVIXA عند فتحه، وتحتاج إشعارات الجهاز إلى موافقتك الصريحة.</small></section>
    <div className="preference-heading"><div><small>أنواع التنبيهات</small><h3>حدد أين يصلك كل تنبيه</h3></div><span>داخل NAVIXA · Telegram</span></div>
    <div className="alert-prefs-list">{prefs&&ALERT_TYPES.map(type=><div key={type} className="alert-prefs-row"><b>{ALERT_LABELS[type]}</b><label><input type="checkbox" checked={prefs[type].screen} onChange={()=>toggle(type,"screen")}/> داخل NAVIXA</label><label className={!connected?"unavailable":""}><input type="checkbox" checked={prefs[type].telegram} disabled={!connected} onChange={()=>toggle(type,"telegram")}/> Telegram</label></div>)}</div>
  </div>;
}
