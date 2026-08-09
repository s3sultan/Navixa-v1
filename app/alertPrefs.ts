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
export const getTelegramConfig=():TelegramConfig|null=>{try{const c=JSON.parse(localStorage.getItem("navixa-telegram-config")||"null");return c?.token&&c?.chatId?c:null}catch{return null}};
export const setTelegramConfig=(config:TelegramConfig)=>localStorage.setItem("navixa-telegram-config",JSON.stringify(config));
export const clearTelegramConfig=()=>localStorage.removeItem("navixa-telegram-config");

export const sendTelegramAlert=(type:AlertType,fallbackMessage:string)=>{
  if(!isTelegramEnabled(type))return;
  const config=getTelegramConfig();
  if(!config)return;
  const custom=getAdminMessages()[type];
  void fetch("/api/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:config.token,chatId:config.chatId,message:custom||fallbackMessage})}).catch(()=>{});
};
