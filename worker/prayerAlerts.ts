import { decryptTelegramIdentifier, sendOfficialTelegramMessage } from "./telegramBot";

type Stmt={bind:(...v:unknown[])=>Stmt;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Db={prepare:(sql:string)=>Stmt};
type Env={DB:Db;NAVIXA_TELEGRAM_BOT_TOKEN?:string;NAVIXA_TELEGRAM_ENCRYPTION_KEY?:string};
type Link={chat_id_ciphertext:string};
type Manual={bot_token_ciphertext:string;chat_id_ciphertext:string};
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
async function send(env:Env,userId:string,text:string){if(!env.NAVIXA_TELEGRAM_ENCRYPTION_KEY)return false;const manual=(await env.DB.prepare("SELECT bot_token_ciphertext,chat_id_ciphertext FROM navixa_user_telegram_manual WHERE user_id=? AND revoked_at='' LIMIT 1").bind(userId).all<Manual>()).results[0];if(manual){try{const[token,chatId]=await Promise.all([decryptTelegramIdentifier(manual.bot_token_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY),decryptTelegramIdentifier(manual.chat_id_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY)]);return await sendOfficialTelegramMessage({chatId,token,text})}catch{}}
  if(!env.NAVIXA_TELEGRAM_BOT_TOKEN)return false;const link=(await env.DB.prepare("SELECT chat_id_ciphertext FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(userId).all<Link>()).results[0];if(!link)return false;try{return await sendOfficialTelegramMessage({chatId:await decryptTelegramIdentifier(link.chat_id_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY),token:env.NAVIXA_TELEGRAM_BOT_TOKEN,text})}catch{return false}}
async function reserve(db:Db,userId:string,eventKey:string){const result=await db.prepare("INSERT OR IGNORE INTO navixa_prayer_alert_delivery(user_id,event_key,created_at) VALUES(?,?,?)").bind(userId,eventKey,new Date().toISOString()).run();return changes(result)>0}
async function release(db:Db,userId:string,eventKey:string){await db.prepare("DELETE FROM navixa_prayer_alert_delivery WHERE user_id=? AND event_key=?").bind(userId,eventKey).run()}

export async function deliverDuePrayerAlerts(env:Env,now=new Date()){
  const rows=await env.DB.prepare("SELECT p.user_id,MAX(CASE WHEN p.notification_type='adhan' AND p.enabled=1 THEN 1 ELSE 0 END) AS adhan_enabled,MAX(CASE WHEN p.notification_type='iqama' AND p.enabled=1 THEN 1 ELSE 0 END) AS iqama_enabled,s.location_mode,s.city,s.country,s.latitude,s.longitude,s.label,s.adjustments_json,s.iqama_json FROM navixa_user_telegram_preferences p LEFT JOIN navixa_prayer_alert_settings s ON s.user_id=p.user_id WHERE p.notification_type IN ('adhan','iqama') AND p.enabled=1 GROUP BY p.user_id").all<UserRow>();
  if(!rows.results.length)return{checked:0,due:0,delivered:0};
  const cache=new Map<string,Awaited<ReturnType<typeof fetchTimings>>>();let due=0,delivered=0;
  for(const row of rows.results){
    let schedule:Awaited<ReturnType<typeof fetchTimings>>;const key=locationKey(row);
    try{schedule=cache.get(key)||await fetchTimings(row);cache.set(key,schedule)}catch{continue}
    const {date,hhmm}=localParts(schedule.timezone,now),adjustments=jsonMap<number>(row.adjustments_json),manualIqama=jsonMap<string>(row.iqama_json);
    for(const prayer of prayers){
      const base=clean(schedule.timings[prayer]);if(!base)continue;const adjusted=addMinutes(base,Number(adjustments[prayer])||0);const iqama=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(manualIqama[prayer]||"")?manualIqama[prayer]:addMinutes(adjusted,iqamaOffsets[prayer]);
      const events:Array<{type:"adhan"|"iqama";time:string;enabled:boolean;message:string}>=[
        {type:"adhan",time:adjusted,enabled:row.adhan_enabled===1,message:`🕌 حان الآن أذان ${labels[prayer]} · ${adjusted}`},
        {type:"iqama",time:iqama,enabled:row.iqama_enabled===1,message:`🕌 حانت الآن إقامة ${labels[prayer]} · ${iqama}`},
      ];
      for(const event of events){if(!event.enabled||event.time!==hhmm)continue;due++;const eventKey=`${date}:${event.type}:${prayer}`;if(!await reserve(env.DB,row.user_id,eventKey))continue;const ok=await send(env,row.user_id,event.message);if(ok)delivered++;else await release(env.DB,row.user_id,eventKey)}
    }
  }
  const cutoff=new Date(now.getTime()-60*86400000).toISOString();await env.DB.prepare("DELETE FROM navixa_prayer_alert_delivery WHERE created_at<?").bind(cutoff).run().catch(()=>{});
  return{checked:rows.results.length,due,delivered};
}
