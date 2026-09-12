import { decryptTelegramIdentifier, sendOfficialTelegramMessage } from "./telegramBot";
import {sendFeaturePush} from "./generalPush.ts";
import {ensureUserPushPreferenceSchema,isUserPushCategoryActive} from "./userPushPreferences.ts";

type Stmt={bind:(...v:unknown[])=>Stmt;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Db={prepare:(sql:string)=>Stmt};
type Env={DB:Db;NAVIXA_TELEGRAM_BOT_TOKEN?:string;NAVIXA_TELEGRAM_ENCRYPTION_KEY?:string};
type Link={chat_id_ciphertext:string};
type Manual={bot_token_ciphertext:string;chat_id_ciphertext:string};
type PushSub={endpoint:string;p256dh:string;auth:string};
type UserRow={user_id:string;adhan_enabled:number;iqama_enabled:number;location_mode:string|null;city:string|null;country:string|null;latitude:number|null;longitude:number|null;label:string|null;adjustments_json:string|null;iqama_json:string|null};
type Prayer="Fajr"|"Dhuhr"|"Asr"|"Maghrib"|"Isha";
type ApiResult={data?:{timings?:Record<string,string>;meta?:{timezone?:string}}};
const prayers:Prayer[]=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const labels:Record<Prayer,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const iqamaOffsets:Record<Prayer,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
const changes=(v:unknown)=>((v as {meta?:{changes?:number}})?.meta?.changes||0);

function clean(value:string|undefined){const match=String(value||"").match(/\b([01]\d|2[0-3]):[0-5]\d\b/);return match?.[0]||""}
function addMinutes(value:string,minutes:number){const [h,m]=value.split(":").map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return "";const total=((h*60+m+minutes)%1440+1440)%1440;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`}
function jsonMap<T>(value:string|null|undefined){try{const parsed=JSON.parse(value||"{}");return parsed&&typeof parsed==="object"?parsed as Record<string,T>:{} }catch{return {}}}
function localParts(timeZone:string,now:Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now),get=(type:string)=>parts.find(part=>part.type===type)?.value||"";return{date:`${get("year")}-${get("month")}-${get("day")}`,hhmm:`${get("hour")}:${get("minute")}`}}
function locationKey(row:UserRow){return row.location_mode==="city"&&row.city&&row.country?`city:${row.city.toLowerCase()}:${row.country.toLowerCase()}`:row.latitude!=null&&row.longitude!=null?`coords:${row.latitude.toFixed(4)}:${row.longitude.toFixed(4)}`:"coords:24.7136:46.6753"}
function apiUrl(row:UserRow){if(row.location_mode==="city"&&row.city&&row.country)return `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(row.city)}&country=${encodeURIComponent(row.country)}&method=4&school=0`;const lat=row.latitude??24.7136,lng=row.longitude??46.6753;return `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&method=4&school=0`}
async function fetchTimings(row:UserRow){const response=await fetch(apiUrl(row),{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("prayer_times_failed");const payload=await response.json() as ApiResult;if(!payload.data?.timings)throw new Error("prayer_times_missing");return{timings:payload.data.timings,timezone:payload.data.meta?.timezone||"Asia/Riyadh"}}
async function sendTelegram(env:Env,userId:string,text:string){if(!env.NAVIXA_TELEGRAM_ENCRYPTION_KEY)return false;const manual=(await env.DB.prepare("SELECT bot_token_ciphertext,chat_id_ciphertext FROM navixa_user_telegram_manual WHERE user_id=? AND revoked_at='' LIMIT 1").bind(userId).all<Manual>()).results[0];if(manual){try{const[token,chatId]=await Promise.all([decryptTelegramIdentifier(manual.bot_token_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY),decryptTelegramIdentifier(manual.chat_id_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY)]);return await sendOfficialTelegramMessage({chatId,token,text})}catch{}}
  if(!env.NAVIXA_TELEGRAM_BOT_TOKEN)return false;const link=(await env.DB.prepare("SELECT chat_id_ciphertext FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(userId).all<Link>()).results[0];if(!link)return false;try{return await sendOfficialTelegramMessage({chatId:await decryptTelegramIdentifier(link.chat_id_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY),token:env.NAVIXA_TELEGRAM_BOT_TOKEN,text})}catch{return false}}
async function sendPush(env:Env,userId:string,title:string,body:string,eventKey:string){
  if(!await isUserPushCategoryActive(env.DB,userId,"adhan"))return 0;
  const subscriptions=(await env.DB.prepare("SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE user_id=?").bind(userId).all<PushSub>()).results;
  let delivered=0;
  for(const subscription of subscriptions){
    const result=await sendFeaturePush(subscription,{kind:"general",title,body,url:"/worship",tag:`adhan-${eventKey}`,urgency:"high",ttl:600});
    if(result.ok){delivered++;continue}
    if(result.status===404||result.status===410)await env.DB.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=? AND user_id=?").bind(subscription.endpoint,userId).run().catch(()=>{});
  }
  return delivered;
}
async function reserve(db:Db,userId:string,eventKey:string){const result=await db.prepare("INSERT OR IGNORE INTO navixa_prayer_alert_delivery(user_id,event_key,created_at) VALUES(?,?,?)").bind(userId,eventKey,new Date().toISOString()).run();return changes(result)>0}
async function release(db:Db,userId:string,eventKey:string){await db.prepare("DELETE FROM navixa_prayer_alert_delivery WHERE user_id=? AND event_key=?").bind(userId,eventKey).run()}

export async function deliverDuePrayerAlerts(env:Env,now=new Date()){
  await ensureUserPushPreferenceSchema(env.DB);
  const rows=await env.DB.prepare("WITH users AS (SELECT user_id FROM navixa_user_telegram_preferences WHERE notification_type IN ('adhan','iqama') AND enabled=1 UNION SELECT user_id FROM navixa_user_push_preferences WHERE category='adhan' AND enabled=1) SELECT u.user_id,COALESCE((SELECT MAX(CASE WHEN p.notification_type='adhan' AND p.enabled=1 THEN 1 ELSE 0 END) FROM navixa_user_telegram_preferences p WHERE p.user_id=u.user_id),0) AS adhan_enabled,COALESCE((SELECT MAX(CASE WHEN p.notification_type='iqama' AND p.enabled=1 THEN 1 ELSE 0 END) FROM navixa_user_telegram_preferences p WHERE p.user_id=u.user_id),0) AS iqama_enabled,s.location_mode,s.city,s.country,s.latitude,s.longitude,s.label,s.adjustments_json,s.iqama_json FROM users u LEFT JOIN navixa_prayer_alert_settings s ON s.user_id=u.user_id").all<UserRow>();
  if(!rows.results.length)return{checked:0,due:0,telegramDelivered:0,pushDelivered:0};
  const cache=new Map<string,Awaited<ReturnType<typeof fetchTimings>>>();let due=0,telegramDelivered=0,pushDelivered=0;
  for(const row of rows.results){
    let schedule:Awaited<ReturnType<typeof fetchTimings>>;const key=locationKey(row);
    try{schedule=cache.get(key)||await fetchTimings(row);cache.set(key,schedule)}catch{continue}
    const {date,hhmm}=localParts(schedule.timezone,now),adjustments=jsonMap<number>(row.adjustments_json),manualIqama=jsonMap<string>(row.iqama_json);
    for(const prayer of prayers){
      const base=clean(schedule.timings[prayer]);if(!base)continue;const adjusted=addMinutes(base,Number(adjustments[prayer])||0);const iqama=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(manualIqama[prayer]||"")?manualIqama[prayer]:addMinutes(adjusted,iqamaOffsets[prayer]);
      const events:Array<{type:"adhan"|"iqama";time:string;telegramEnabled:boolean;title:string;message:string}>=[
        {type:"adhan",time:adjusted,telegramEnabled:row.adhan_enabled===1,title:`حان أذان ${labels[prayer]}`,message:`🕌 حان الآن أذان ${labels[prayer]} · ${adjusted}`},
        {type:"iqama",time:iqama,telegramEnabled:row.iqama_enabled===1,title:`حانت إقامة ${labels[prayer]}`,message:`🕌 حانت الآن إقامة ${labels[prayer]} · ${iqama}`},
      ];
      for(const event of events){
        if(event.time!==hhmm)continue;
        const baseKey=`${date}:${event.type}:${prayer}`;
        const pushActive=event.type==="adhan"&&await isUserPushCategoryActive(env.DB,row.user_id,"adhan");
        if(!event.telegramEnabled&&!pushActive)continue;
        due++;
        if(event.telegramEnabled){const key=`${baseKey}:telegram`;if(await reserve(env.DB,row.user_id,key)){const ok=await sendTelegram(env,row.user_id,event.message);if(ok)telegramDelivered++;else await release(env.DB,row.user_id,key)}}
        if(pushActive){const key=`${baseKey}:push`;if(await reserve(env.DB,row.user_id,key)){const count=await sendPush(env,row.user_id,event.title,event.message,baseKey);if(count>0)pushDelivered+=count;else await release(env.DB,row.user_id,key)}}
      }
    }
  }
  const cutoff=new Date(now.getTime()-60*86400000).toISOString();await env.DB.prepare("DELETE FROM navixa_prayer_alert_delivery WHERE created_at<?").bind(cutoff).run().catch(()=>{});
  return{checked:rows.results.length,due,telegramDelivered,pushDelivered};
}
