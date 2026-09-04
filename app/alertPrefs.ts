export type AlertType="adhan"|"iqama"|"water"|"break"|"focus"|"name"|"wird"|"sadaqah"|"task";
export type Policy="user"|"on"|"off";
type Channels={screen:boolean;telegram:boolean};
type PolicyChannels={screen:Policy;telegram:Policy};

export const ALERT_TYPES:AlertType[]=["adhan","iqama","water","break","focus","name","wird","sadaqah","task"];
export const ALERT_LABELS:Record<AlertType,string>={
  adhan:"تنبيه الأذان",iqama:"تنبيه الإقامة",water:"تذكير الماء",break:"تذكير الحركة",
  focus:"انتهاء جلسة التركيز",name:"سماع الاسم",wird:"إتمام الورد اليومي",sadaqah:"تذكير الصدقة",task:"إنجاز مهمة"
};

const USER_PREFS_KEY="navixa-alert-prefs";
const ADMIN_POLICY_CACHE_KEY="navixa-admin-alert-policy";
const ADMIN_MESSAGES_CACHE_KEY="navixa-admin-alert-messages";
const defaultUserPrefs=():Record<AlertType,Channels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:true,telegram:true}])) as Record<AlertType,Channels>;
const defaultAdminPolicy=():Record<AlertType,PolicyChannels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:"user",telegram:"user"}])) as Record<AlertType,PolicyChannels>;

export const getUserPrefs=():Record<AlertType,Channels>=>{try{return {...defaultUserPrefs(),...JSON.parse(localStorage.getItem(USER_PREFS_KEY)||"{}")} }catch{return defaultUserPrefs()}};
export const setUserPrefs=(prefs:Record<AlertType,Channels>)=>localStorage.setItem(USER_PREFS_KEY,JSON.stringify(prefs));
export const getAdminPolicy=():Record<AlertType,PolicyChannels>=>{try{return {...defaultAdminPolicy(),...JSON.parse(localStorage.getItem(ADMIN_POLICY_CACHE_KEY)||"{}")} }catch{return defaultAdminPolicy()}};
export const setAdminPolicy=(policy:Record<AlertType,PolicyChannels>)=>localStorage.setItem(ADMIN_POLICY_CACHE_KEY,JSON.stringify(policy));
export const getAdminMessages=():Partial<Record<AlertType,string>>=>{try{return JSON.parse(localStorage.getItem(ADMIN_MESSAGES_CACHE_KEY)||"{}")}catch{return {}}};
export const setAdminMessages=(msgs:Partial<Record<AlertType,string>>)=>localStorage.setItem(ADMIN_MESSAGES_CACHE_KEY,JSON.stringify(msgs));

export const refreshAdminAlertSettings=async()=>{
  try{
    const response=await fetch("/api/alert-policy",{cache:"no-store"});
    const data=await response.json().catch(()=>({})) as {policy?:Record<AlertType,PolicyChannels>;messages?:Partial<Record<AlertType,string>>};
    if(response.ok&&data.policy)setAdminPolicy(data.policy);
    if(response.ok&&data.messages)setAdminMessages(data.messages);
    return response.ok;
  }catch{return false}
};

export const refreshUserAlertSettings=async()=>{
  try{
    const response=await fetch("/api/account/notifications/preferences",{cache:"no-store"});
    const data=await response.json().catch(()=>({})) as {preferences?:Record<AlertType,{screen:boolean;telegram:boolean;push?:boolean}>};
    if(!response.ok||!data.preferences)return false;
    const next=defaultUserPrefs();
    ALERT_TYPES.forEach(type=>{const row=data.preferences?.[type];if(row)next[type]={screen:row.screen!==false,telegram:row.telegram!==false}});
    setUserPrefs(next);
    return true;
  }catch{return false}
};

export const hydrateAlertSettings=async()=>{await Promise.all([refreshAdminAlertSettings(),refreshUserAlertSettings()]);return {user:getUserPrefs(),policy:getAdminPolicy(),messages:getAdminMessages()}};
if(typeof window!=="undefined")void hydrateAlertSettings();

const isChannelEnabled=(type:AlertType,channel:"screen"|"telegram"):boolean=>{
  const policy=getAdminPolicy()[type]?.[channel]||"user";
  if(policy==="on")return true;
  if(policy==="off")return false;
  return getUserPrefs()[type]?.[channel]!==false;
};
export const isScreenEnabled=(type:AlertType)=>isChannelEnabled(type,"screen");
export const isTelegramEnabled=(type:AlertType)=>isChannelEnabled(type,"telegram");

const LEGACY_TELEGRAM_STORAGE_KEY="navixa-telegram-config";
export const purgeLegacyTelegramConfig=()=>{try{localStorage.removeItem(LEGACY_TELEGRAM_STORAGE_KEY)}catch{}};
purgeLegacyTelegramConfig();

export const sendTelegramMessage=async(message:string,type?:AlertType):Promise<boolean>=>{
  try{
    const response=await fetch("/api/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message,type})});
    return response.ok;
  }catch{return false}
};

export const sendTelegramAlert=(type:AlertType,fallbackMessage:string)=>{
  if(!isTelegramEnabled(type))return;
  const custom=getAdminMessages()[type];
  void sendTelegramMessage(custom||fallbackMessage,type);
};
