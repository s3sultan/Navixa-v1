export type AlertType="adhan"|"iqama"|"water"|"break"|"focus"|"name"|"wird"|"sadaqah"|"task";
export type Policy="user"|"on"|"off";
type Channels={screen:boolean;telegram:boolean};
type PolicyChannels={screen:Policy;telegram:Policy};

export const ALERT_TYPES:AlertType[]=["adhan","iqama","water","break","focus","name","wird","sadaqah","task"];
export const ALERT_LABELS:Record<AlertType,string>={
  adhan:"تنبيه الأذان",iqama:"تنبيه الإقامة",water:"تذكير الماء",break:"تذكير الحركة",
  focus:"انتهاء جلسة التركيز",name:"سماع الاسم",wird:"إتمام الورد اليومي",sadaqah:"تذكير الصدقة",task:"إنجاز مهمة"
};

const defaultUserPrefs=():Record<AlertType,Channels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:true,telegram:true}])) as Record<AlertType,Channels>;
const defaultAdminPolicy=():Record<AlertType,PolicyChannels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:"user",telegram:"user"}])) as Record<AlertType,PolicyChannels>;

export const getUserPrefs=():Record<AlertType,Channels>=>{try{return {...defaultUserPrefs(),...JSON.parse(localStorage.getItem("navixa-alert-prefs")||"{}")}}catch{return defaultUserPrefs()}};
export const setUserPrefs=(prefs:Record<AlertType,Channels>)=>localStorage.setItem("navixa-alert-prefs",JSON.stringify(prefs));
export const getAdminPolicy=():Record<AlertType,PolicyChannels>=>{try{return {...defaultAdminPolicy(),...JSON.parse(localStorage.getItem("navixa-admin-alert-policy")||"{}")}}catch{return defaultAdminPolicy()}};
export const setAdminPolicy=(policy:Record<AlertType,PolicyChannels>)=>localStorage.setItem("navixa-admin-alert-policy",JSON.stringify(policy));
export const getAdminMessages=():Partial<Record<AlertType,string>>=>{try{return JSON.parse(localStorage.getItem("navixa-admin-alert-messages")||"{}")}catch{return {}}};
export const setAdminMessages=(msgs:Partial<Record<AlertType,string>>)=>localStorage.setItem("navixa-admin-alert-messages",JSON.stringify(msgs));

const isChannelEnabled=(type:AlertType,channel:"screen"|"telegram"):boolean=>{
  const policy=getAdminPolicy()[type]?.[channel]||"user";
  if(policy==="on")return true;
  if(policy==="off")return false;
  return getUserPrefs()[type]?.[channel]!==false;
};
export const isScreenEnabled=(type:AlertType)=>isChannelEnabled(type,"screen");
export const isTelegramEnabled=(type:AlertType)=>isChannelEnabled(type,"telegram");

export type TelegramConfig={token:string;chatId:string};
const LEGACY_TELEGRAM_STORAGE_KEY="navixa-telegram-config";
let sessionTelegramConfig:TelegramConfig|null=null;

// Telegram credentials are intentionally session-only. A prior localStorage value
// is deleted on first access so it cannot continue to survive browser restarts.
function clearLegacyTelegramConfig(){
  try{localStorage.removeItem(LEGACY_TELEGRAM_STORAGE_KEY)}catch{}
}
export const getTelegramConfig=():TelegramConfig|null=>{
  clearLegacyTelegramConfig();
  return sessionTelegramConfig;
};
export const setTelegramConfig=(config:TelegramConfig)=>{
  clearLegacyTelegramConfig();
  const token=config.token.trim();
  const chatId=config.chatId.trim();
  sessionTelegramConfig=token&&chatId?{token,chatId}:null;
};
export const clearTelegramConfig=()=>{
  sessionTelegramConfig=null;
  clearLegacyTelegramConfig();
};
export const isTelegramConfigSessionOnly=()=>true;

export const sendTelegramMessage=async(config:TelegramConfig,message:string):Promise<boolean>=>{
  try{
    const response=await fetch("/api/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:config.token,chatId:config.chatId,message})});
    return response.ok;
  }catch{return false}
};

export const sendTelegramAlert=(type:AlertType,fallbackMessage:string)=>{
  if(!isTelegramEnabled(type))return;
  const config=getTelegramConfig();
  if(!config)return;
  const custom=getAdminMessages()[type];
  void sendTelegramMessage(config,custom||fallbackMessage);
};
