import { decryptTelegramIdentifier, sendOfficialTelegramMessage } from "./telegramBot";
import { deliverDuePrayerAlerts } from "./prayerAlerts";
import { sendFeaturePush } from "./generalPush";

type Stmt={bind:(...v:unknown[])=>Stmt;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Db={prepare:(sql:string)=>Stmt};
type Env={DB:Db;RESEND_API_KEY?:string;RESEND_FROM_EMAIL?:string;NAVIXA_AUTH_FROM?:string;NAVIXA_TELEGRAM_BOT_TOKEN?:string;NAVIXA_TELEGRAM_ENCRYPTION_KEY?:string};
type Row={id:string;user_id:string;email:string;title:string;due_at:string;source:string;email_enabled:number;telegram_enabled:number;push_enabled:number;email_status:string;telegram_status:string;push_status:string;email_attempts:number;telegram_attempts:number;push_attempts:number;email_last_attempt_at:string;telegram_last_attempt_at:string;push_last_attempt_at:string};
type PushSubscription={endpoint:string;p256dh:string;auth:string};
type Channel="email"|"telegram"|"push";
const retry=60*60_000, maxAttempts=3; const changes=(v:unknown)=>((v as {meta?:{changes?:number}})?.meta?.changes||0);

export async function ensureImportantReminderSchema(db:Db){
 await db.prepare("CREATE TABLE IF NOT EXISTS navixa_important_reminders (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,due_at TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'manual',email_enabled INTEGER NOT NULL DEFAULT 0,telegram_enabled INTEGER NOT NULL DEFAULT 0,push_enabled INTEGER NOT NULL DEFAULT 1,email_status TEXT NOT NULL DEFAULT 'pending',telegram_status TEXT NOT NULL DEFAULT 'pending',push_status TEXT NOT NULL DEFAULT 'pending',email_attempts INTEGER NOT NULL DEFAULT 0,telegram_attempts INTEGER NOT NULL DEFAULT 0,push_attempts INTEGER NOT NULL DEFAULT 0,email_last_attempt_at TEXT NOT NULL DEFAULT '',telegram_last_attempt_at TEXT NOT NULL DEFAULT '',push_last_attempt_at TEXT NOT NULL DEFAULT '',email_sent_at TEXT NOT NULL DEFAULT '',telegram_sent_at TEXT NOT NULL DEFAULT '',push_sent_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,title,due_at))").run();
 const additions=[
  "ALTER TABLE navixa_important_reminders ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
  "ALTER TABLE navixa_important_reminders ADD COLUMN push_enabled INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE navixa_important_reminders ADD COLUMN push_status TEXT NOT NULL DEFAULT 'pending'",
  "ALTER TABLE navixa_important_reminders ADD COLUMN push_attempts INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE navixa_important_reminders ADD COLUMN push_last_attempt_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE navixa_important_reminders ADD COLUMN push_sent_at TEXT NOT NULL DEFAULT ''",
 ];
 for(const sql of additions){try{await db.prepare(sql).run()}catch{/* Existing production column. */}}
 await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_important_reminders_due ON navixa_important_reminders(due_at)").run();
}
async function claim(db:Db,row:Row,ch:Channel,now:string){const s=row[`${ch}_status`],a=row[`${ch}_attempts`],last=row[`${ch}_last_attempt_at`];if(s==="sent"||a>=maxAttempts||(last&&Date.now()-Date.parse(last)<retry))return false;return changes(await db.prepare(`UPDATE navixa_important_reminders SET ${ch}_status='sending',${ch}_attempts=${ch}_attempts+1,${ch}_last_attempt_at=?,updated_at=? WHERE id=? AND ${ch}_status IN ('pending','failed')`).bind(now,now,row.id).run())>0}
async function done(db:Db,id:string,ch:Channel,ok:boolean,now:string){await db.prepare(`UPDATE navixa_important_reminders SET ${ch}_status=?,${ch}_sent_at=?,updated_at=? WHERE id=?`).bind(ok?"sent":"failed",ok?now:"",now,id).run()}
async function email(env:Env,to:string,title:string){const from=env.RESEND_FROM_EMAIL||env.NAVIXA_AUTH_FROM;if(!from||!env.RESEND_API_KEY)return false;return (await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject:`تذكير مهم من NAVIXA: ${title}`,text:`تذكير مهم\n\n${title}\n\nNAVIXA SA`})})).ok}
async function telegram(env:Env,db:Db,row:Row){if(!env.NAVIXA_TELEGRAM_BOT_TOKEN||!env.NAVIXA_TELEGRAM_ENCRYPTION_KEY)return false;const r=await db.prepare("SELECT chat_id_ciphertext FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(row.user_id).all<{chat_id_ciphertext:string}>();if(!r.results[0])return false;try{return await sendOfficialTelegramMessage({chatId:await decryptTelegramIdentifier(r.results[0].chat_id_ciphertext,env.NAVIXA_TELEGRAM_ENCRYPTION_KEY),token:env.NAVIXA_TELEGRAM_BOT_TOKEN,text:`🔔 تذكير مهم من NAVIXA\n\n${row.title}`})}catch{return false}}
async function push(db:Db,row:Row){
 const subscriptions=await db.prepare("SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE user_id=? AND enabled=1 LIMIT 8").bind(row.user_id).all<PushSubscription>();
 let sent=false;
 const schedule=row.source==="schedule";
 for(const subscription of subscriptions.results){
  const result=await sendFeaturePush(subscription,{kind:"general",title:schedule?"تذكير من جدولك":"تذكير مهم من NAVIXA",body:row.title,url:schedule?"/today":"/reminders",tag:schedule?`navixa-schedule-${row.id}`:`navixa-reminder-${row.id}`,urgency:"high",ttl:schedule?1800:3600});
  if(result.ok){sent=true;continue}
  if(result.status===404||result.status===410)await db.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=? AND user_id=?").bind(subscription.endpoint,row.user_id).run();
 }
 return sent;
}
export async function deliverDueImportantReminders(env:Env){try{await deliverDuePrayerAlerts(env)}catch{}await ensureImportantReminderSchema(env.DB);const now=new Date().toISOString(),rows=await env.DB.prepare("SELECT r.*,u.email FROM navixa_important_reminders r JOIN navixa_users u ON u.id=r.user_id WHERE r.due_at<=? AND ((r.email_enabled=1 AND r.email_status IN ('pending','failed')) OR (r.telegram_enabled=1 AND r.telegram_status IN ('pending','failed')) OR (r.push_enabled=1 AND r.push_status IN ('pending','failed'))) ORDER BY r.due_at LIMIT 30").bind(now).all<Row>();let delivered=0;for(const r of rows.results){if(r.email_enabled&&await claim(env.DB,r,"email",now)){const ok=await email(env,r.email,r.title);await done(env.DB,r.id,"email",ok,now);delivered+=ok?1:0}if(r.telegram_enabled&&await claim(env.DB,r,"telegram",now)){const ok=await telegram(env,env.DB,r);await done(env.DB,r.id,"telegram",ok,now);delivered+=ok?1:0}if(r.push_enabled&&await claim(env.DB,r,"push",now)){const ok=await push(env.DB,r);await done(env.DB,r.id,"push",ok,now);delivered+=ok?1:0}}return {checked:rows.results.length,delivered}}
