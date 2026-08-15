"use client";
import {FormEvent,useEffect,useState} from "react";
import {ALERT_LABELS,ALERT_TYPES,AlertType,TelegramConfig,clearTelegramConfig,getTelegramConfig,getUserPrefs,sendTelegramMessage,setTelegramConfig,setUserPrefs} from "./alertPrefs";
import {getPersonalReminderPrefs,PersonalReminderPrefs,setPersonalReminderPrefs} from "./reminderPrefs";

type Prefs=Record<AlertType,{screen:boolean;telegram:boolean}>;
type Props={onPreviewReminder:(message:string)=>void};

export default function NotificationCenter({onPreviewReminder}:Props){
  const [prefs,setPrefs]=useState<Prefs|null>(null);
  const [config,setConfig]=useState<TelegramConfig>({token:"",chatId:""});
  const [connected,setConnected]=useState(false);
  const [status,setStatus]=useState("");
  const [testing,setTesting]=useState(false);
  const [reminderPrefs,setReminderPrefs]=useState<PersonalReminderPrefs|null>(null);
  const [browserPermission,setBrowserPermission]=useState<NotificationPermission|"unsupported">("unsupported");

  useEffect(()=>{const saved=getTelegramConfig();setPrefs(getUserPrefs());setReminderPrefs(getPersonalReminderPrefs());setBrowserPermission("Notification" in window?Notification.permission:"unsupported");if(saved){setConfig(saved);setConnected(true)}},[]);
  const saveTelegram=(event:FormEvent)=>{event.preventDefault();const next={token:config.token.trim(),chatId:config.chatId.trim()};setTelegramConfig(next);setConfig(next);setConnected(true);setStatus("تم حفظ قناة Telegram")};
  const disconnect=()=>{clearTelegramConfig();setConfig({token:"",chatId:""});setConnected(false);setStatus("تم فصل قناة Telegram")};
  const test=async()=>{if(!connected)return;setTesting(true);setStatus("");const ok=await sendTelegramMessage(config,"🔔 رسالة تجريبية من مركز تنبيهات NAVIXA");setTesting(false);setStatus(ok?"وصل التنبيه التجريبي بنجاح":"تعذر إرسال التنبيه — راجع بيانات البوت")};
  const toggle=(type:AlertType,channel:"screen"|"telegram")=>{if(!prefs)return;const next={...prefs,[type]:{...prefs[type],[channel]:!prefs[type][channel]}};setPrefs(next);setUserPrefs(next)};
  const updateReminderPrefs=(patch:Partial<PersonalReminderPrefs>)=>{if(!reminderPrefs)return;const next={...reminderPrefs,...patch};setReminderPrefs(next);setPersonalReminderPrefs(next)};
  const requestBrowserNotifications=async()=>{if(!("Notification" in window)){setBrowserPermission("unsupported");return}const permission=await Notification.requestPermission();setBrowserPermission(permission);if(permission==="granted")updateReminderPrefs({browser:true});if(permission!=="granted")setStatus("لم تُمنح صلاحية إشعارات الجهاز؛ ستبقى التذكيرات داخل NAVIXA")};
  const previewReminder=()=>{const title="تذكير ماء لطيف",body="مر وقت منذ آخر كوب ماء مسجّل. خذ رشفة إذا احتجت.";if(reminderPrefs?.browser&&"Notification" in window&&Notification.permission==="granted")new Notification(title,{body,tag:"navixa-preview"});onPreviewReminder(`${title} — ${body}`);setStatus("ظهرت معاينة التذكير الآن")};

  return <div className="notification-center">
    <div className="channel-summary"><div><span className="channel-icon">➤</span><p><small>القناة المتاحة حاليًا</small><b>Telegram الشخصي</b><em className={connected?"connected":""}>{connected?"● متصل":"○ غير متصل"}</em></p></div>{connected&&<div className="channel-actions"><button type="button" onClick={test} disabled={testing}>{testing?"جارٍ الاختبار…":"إرسال تجربة"}</button><button type="button" className="disconnect" onClick={disconnect}>فصل</button></div>}</div>
    {!connected&&<form className="telegram-connect" onSubmit={saveTelegram}><p>اربط بوتك الشخصي لاستقبال تنبيهاتك أنت فقط.</p><input value={config.token} onChange={e=>setConfig({...config,token:e.target.value})} placeholder="Bot Token" required/><input value={config.chatId} onChange={e=>setConfig({...config,chatId:e.target.value})} placeholder="Chat ID" required/><button>ربط Telegram</button><small>يمكنك أخذ الرمز من BotFather ومعرّف المحادثة من userinfobot.</small></form>}
    {status&&<p className="channel-status" role="status">{status}</p>}
    <section className="personal-reminder-settings" aria-labelledby="personal-reminders-title"><div className="personal-reminder-heading"><div><small>تذكيراتك الشخصية</small><h3 id="personal-reminders-title">تصل عندما تكون مناسبة لك</h3><p>نعتمد على آخر تفاعل وآخر كوب ماء وفترة الهدوء التي تختارها، ولا نرسل جدولًا موحّدًا للجميع.</p></div><label className="personal-reminder-switch"><input type="checkbox" checked={reminderPrefs?.enabled??false} onChange={e=>updateReminderPrefs({enabled:e.target.checked})}/><span>{reminderPrefs?.enabled?"مفعّلة":"متوقفة"}</span></label></div>{reminderPrefs&&<div className="personal-reminder-controls"><label><input type="checkbox" checked={reminderPrefs.water} onChange={e=>updateReminderPrefs({water:e.target.checked})}/> تذكير الماء</label><label><input type="checkbox" checked={reminderPrefs.break} onChange={e=>updateReminderPrefs({break:e.target.checked})}/> استراحة الحركة</label><label><input type="checkbox" checked={reminderPrefs.eye} onChange={e=>updateReminderPrefs({eye:e.target.checked})}/> راحة العين</label><label className="reminder-quiet-select">فاصل هادئ<select value={reminderPrefs.quietMinutes} onChange={e=>updateReminderPrefs({quietMinutes:Number(e.target.value)})}><option value="25">25 دقيقة</option><option value="35">35 دقيقة</option><option value="45">45 دقيقة</option><option value="60">60 دقيقة</option></select></label><button type="button" className="browser-notification-button" onClick={requestBrowserNotifications} disabled={browserPermission==="granted"}>{browserPermission==="granted"?"إشعارات الجهاز مفعّلة":"تفعيل إشعارات الجهاز"}</button><button type="button" className="personal-reminder-preview-button" onClick={previewReminder}>✦ معاينة تذكير الآن</button></div>}<small className="personal-reminder-note">تظهر التذكيرات دائمًا داخل NAVIXA عند فتحه، وتحتاج إشعارات الجهاز إلى موافقتك الصريحة.</small></section>
    <div className="preference-heading"><div><small>أنواع التنبيهات</small><h3>حدد أين يصلك كل تنبيه</h3></div><span>داخل NAVIXA · Telegram</span></div>
    <div className="alert-prefs-list">{prefs&&ALERT_TYPES.map(type=><div key={type} className="alert-prefs-row"><b>{ALERT_LABELS[type]}</b><label><input type="checkbox" checked={prefs[type].screen} onChange={()=>toggle(type,"screen")}/> داخل NAVIXA</label><label className={!connected?"unavailable":""}><input type="checkbox" checked={prefs[type].telegram} disabled={!connected} onChange={()=>toggle(type,"telegram")}/> Telegram</label></div>)}</div>
  </div>;
}
