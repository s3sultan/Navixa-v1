import {HEALTH_FEATURE_ENABLED,isHealthAlertType} from "./healthFeature";

export type AlertType="adhan"|"iqama"|"water"|"break"|"focus"|"name"|"screen"|"wird"|"sadaqah"|"task";
export type Policy="user"|"on"|"off";
type Channels={screen:boolean;telegram:boolean};
type PolicyChannels={screen:Policy;telegram:Policy};
export type FeatureAlertEvent={kind:"name_heard";name:string}|{kind:"screen_watch";mode:"change"|"ocr";detail?:string};

export const ALERT_TYPES:AlertType[]=["adhan","iqama","water","break","focus","name","screen","wird","sadaqah","task"];
export const ALERT_LABELS:Record<AlertType,string>={
  adhan:"تنبيه الأذان",iqama:"تنبيه الإقامة",water:"تذكير الماء",break:"تذكير الحركة",
  focus:"انتهاء جلسة التركيز",name:"سماع الاسم",screen:"متابعة الشاشة",wird:"إتمام الورد اليومي",sadaqah:"تذكير الصدقة",task:"إنجاز مهمة"
};

const defaultUserPrefs=():Record<AlertType,Channels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:t!=="water",telegram:t!=="water"}])) as Record<AlertType,Channels>;
const defaultAdminPolicy=():Record<AlertType,PolicyChannels>=>Object.fromEntries(ALERT_TYPES.map(t=>[t,{screen:t==="water"?"off":"user",telegram:t==="water"?"off":"user"}])) as Record<AlertType,PolicyChannels>;

export const getUserPrefs=():Record<AlertType,Channels>=>{try{return {...defaultUserPrefs(),...JSON.parse(localStorage.getItem("navixa-alert-prefs")||"{}")} }catch{return defaultUserPrefs()}};
export const setUserPrefs=(prefs:Record<AlertType,Channels>)=>localStorage.setItem("navixa-alert-prefs",JSON.stringify(prefs));
export const getAdminPolicy=():Record<AlertType,PolicyChannels>=>{try{return {...defaultAdminPolicy(),...JSON.parse(localStorage.getItem("navixa-admin-alert-policy")||"{}")} }catch{return defaultAdminPolicy()}};
export const setAdminPolicy=(policy:Record<AlertType,PolicyChannels>)=>localStorage.setItem("navixa-admin-alert-policy",JSON.stringify(policy));
export const getAdminMessages=():Partial<Record<AlertType,string>>=>{try{return JSON.parse(localStorage.getItem("navixa-admin-alert-messages")||"{}")}catch{return {}}};
export const setAdminMessages=(msgs:Partial<Record<AlertType,string>>)=>localStorage.setItem("navixa-admin-alert-messages",JSON.stringify(msgs));

const isChannelEnabled=(type:AlertType,channel:"screen"|"telegram"):boolean=>{
  if(!HEALTH_FEATURE_ENABLED&&isHealthAlertType(type))return false;
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
  if(type&&!HEALTH_FEATURE_ENABLED&&isHealthAlertType(type))return false;
  try{
    const response=await fetch("/api/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message,type})});
    return response.ok;
  }catch{return false}
};

const forwardFeaturePush=(event:FeatureAlertEvent)=>{
  void import("./pushClient").then(({sendNavixaFeaturePushEvent})=>sendNavixaFeaturePushEvent(event)).catch(()=>{});
};

export const sendFeatureAlert=(type:"name"|"screen",fallbackMessage:string,event:FeatureAlertEvent)=>{
  forwardFeaturePush(event);
  if(!isTelegramEnabled(type))return;
  const custom=getAdminMessages()[type];
  void sendTelegramMessage(custom||fallbackMessage,type);
};

const forwardNameAlert=(message:string)=>{
  const match=message.match(/\(([^()]{1,80})\)\s*$/);
  const name=(match?.[1]||"").trim();
  if(!name)return false;
  sendFeatureAlert("name",message,{kind:"name_heard",name});
  return true;
};

export const sendTelegramAlert=(type:AlertType,fallbackMessage:string)=>{
  if(!HEALTH_FEATURE_ENABLED&&isHealthAlertType(type))return;
  if(type==="name"&&forwardNameAlert(fallbackMessage))return;
  if(!isTelegramEnabled(type))return;
  const custom=getAdminMessages()[type];
  void sendTelegramMessage(custom||fallbackMessage,type);
};
