"use client";
import {FormEvent,useEffect,useState} from "react";
import {ALERT_LABELS,ALERT_TYPES,AlertType,TelegramConfig,clearTelegramConfig,getTelegramConfig,getUserPrefs,sendTelegramMessage,setTelegramConfig,setUserPrefs} from "./alertPrefs";

type Prefs=Record<AlertType,{screen:boolean;telegram:boolean}>;

export default function NotificationCenter(){
  const [prefs,setPrefs]=useState<Prefs|null>(null);
  const [config,setConfig]=useState<TelegramConfig>({token:"",chatId:""});
  const [connected,setConnected]=useState(false);
  const [status,setStatus]=useState("");
  const [testing,setTesting]=useState(false);

  useEffect(()=>{const saved=getTelegramConfig();setPrefs(getUserPrefs());if(saved){setConfig(saved);setConnected(true)}},[]);
  const saveTelegram=(event:FormEvent)=>{event.preventDefault();const next={token:config.token.trim(),chatId:config.chatId.trim()};setTelegramConfig(next);setConfig(next);setConnected(true);setStatus("تم حفظ قناة Telegram")};
  const disconnect=()=>{clearTelegramConfig();setConfig({token:"",chatId:""});setConnected(false);setStatus("تم فصل قناة Telegram")};
  const test=async()=>{if(!connected)return;setTesting(true);setStatus("");const ok=await sendTelegramMessage(config,"🔔 رسالة تجريبية من مركز تنبيهات NAVIXA");setTesting(false);setStatus(ok?"وصل التنبيه التجريبي بنجاح":"تعذر إرسال التنبيه — راجع بيانات البوت")};
  const toggle=(type:AlertType,channel:"screen"|"telegram")=>{if(!prefs)return;const next={...prefs,[type]:{...prefs[type],[channel]:!prefs[type][channel]}};setPrefs(next);setUserPrefs(next)};

  return <div className="notification-center">
    <div className="channel-summary"><div><span className="channel-icon">➤</span><p><small>القناة المتاحة حاليًا</small><b>Telegram الشخصي</b><em className={connected?"connected":""}>{connected?"● متصل":"○ غير متصل"}</em></p></div>{connected&&<div className="channel-actions"><button type="button" onClick={test} disabled={testing}>{testing?"جارٍ الاختبار…":"إرسال تجربة"}</button><button type="button" className="disconnect" onClick={disconnect}>فصل</button></div>}</div>
    {!connected&&<form className="telegram-connect" onSubmit={saveTelegram}><p>اربط بوتك الشخصي لاستقبال تنبيهاتك أنت فقط.</p><input value={config.token} onChange={e=>setConfig({...config,token:e.target.value})} placeholder="Bot Token" required/><input value={config.chatId} onChange={e=>setConfig({...config,chatId:e.target.value})} placeholder="Chat ID" required/><button>ربط Telegram</button><small>يمكنك أخذ الرمز من BotFather ومعرّف المحادثة من userinfobot.</small></form>}
    {status&&<p className="channel-status" role="status">{status}</p>}
    <div className="preference-heading"><div><small>أنواع التنبيهات</small><h3>حدد أين يصلك كل تنبيه</h3></div><span>داخل NAVIXA · Telegram</span></div>
    <div className="alert-prefs-list">{prefs&&ALERT_TYPES.map(type=><div key={type} className="alert-prefs-row"><b>{ALERT_LABELS[type]}</b><label><input type="checkbox" checked={prefs[type].screen} onChange={()=>toggle(type,"screen")}/> داخل NAVIXA</label><label className={!connected?"unavailable":""}><input type="checkbox" checked={prefs[type].telegram} disabled={!connected} onChange={()=>toggle(type,"telegram")}/> Telegram</label></div>)}</div>
  </div>;
}
