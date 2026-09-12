import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { sendFeaturePush, type FeaturePushAction, type FeaturePushKind, type FeaturePushPriority } from "../../../../worker/generalPush.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Subscription={endpoint:string;p256dh:string;auth:string};
type PushUrgency="very-low"|"low"|"normal"|"high";
type LabBody={endpoint?:unknown;kind?:unknown;title?:unknown;body?:unknown;url?:unknown;tag?:unknown;priority?:unknown;actions?:unknown;requireInteraction?:unknown;silent?:unknown;urgency?:unknown;ttl?:unknown;accentColor?:unknown};
type LabAction={action?:unknown;title?:unknown;url?:unknown};
const allowedKinds=new Set<FeaturePushKind>(["name_heard","screen_watch","security","billing","general"]);
const allowedPriorities=new Set<FeaturePushPriority>(["low","normal","important","critical"]);
const allowedUrgency=new Set<PushUrgency>(["very-low","low","normal","high"]);
const actionIdPattern=/^[a-z0-9_-]{1,32}$/i;
const safeRelativeUrl=(value:string)=>value.startsWith("/")&&!value.startsWith("//");

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function isAdmin(request:Request){const secret=await resolveAdminJwtSecret();if(!secret)return false;return Boolean(await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_admin_push_lab_log (id TEXT PRIMARY KEY, admin_email TEXT NOT NULL, endpoint TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, sent_at TEXT NOT NULL)").run()}

function readActions(value:unknown):FeaturePushAction[]{
  if(!Array.isArray(value))return [];
  return value.slice(0,2).flatMap(raw=>{
    if(!raw||typeof raw!=="object")return [];
    const item=raw as LabAction;
    const action=typeof item.action==="string"?item.action.trim():"";
    const title=typeof item.title==="string"?item.title.trim().slice(0,24):"";
    const url=typeof item.url==="string"&&safeRelativeUrl(item.url)?item.url:undefined;
    if(!actionIdPattern.test(action)||!title)return [];
    return [{action,title,url}];
  });
}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  if(!await isAdmin(request))return NextResponse.json({error:"جلسة الإدارة غير صالحة"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as LabBody;
  const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";
  const title=typeof body.title==="string"?body.title.trim().slice(0,80):"";
  const message=typeof body.body==="string"?body.body.trim().slice(0,240):"";
  const kind=allowedKinds.has(body.kind as FeaturePushKind)?body.kind as FeaturePushKind:"general";
  const url=typeof body.url==="string"&&safeRelativeUrl(body.url)?body.url:"/";
  const tag=typeof body.tag==="string"?body.tag.trim().slice(0,80):`navixa-${kind}`;
  const priority=allowedPriorities.has(body.priority as FeaturePushPriority)?body.priority as FeaturePushPriority:undefined;
  const urgency=allowedUrgency.has(body.urgency as PushUrgency)?body.urgency as PushUrgency:undefined;
  const ttlNumber=Number(body.ttl);
  const ttl=Number.isFinite(ttlNumber)?Math.max(30,Math.min(86400,ttlNumber)):undefined;
  const requireInteraction=typeof body.requireInteraction==="boolean"?body.requireInteraction:undefined;
  const accentColor=typeof body.accentColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(body.accentColor)?body.accentColor:undefined;
  const actions=readActions(body.actions);
  if(!/^https:\/\//i.test(endpoint)||!title||!message)return NextResponse.json({error:"بيانات الاختبار ناقصة"},{status:400,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  await schema(database);
  const found=await database.prepare("SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE endpoint=? AND enabled=1 LIMIT 1").bind(endpoint).all<Subscription>();
  const subscription=found.results[0];if(!subscription)return NextResponse.json({error:"فعّل Push على جهاز الإدارة أولًا"},{status:400,headers:{"Cache-Control":"no-store"}});
  const result=await sendFeaturePush(subscription,{kind,title,body:message,url,tag,priority,actions,requireInteraction,silent:body.silent===true,urgency,ttl,accentColor});
  if(!result.ok){if(result.status===404||result.status===410)await database.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=?").bind(endpoint).run();return NextResponse.json({error:"تعذر إرسال Push التجريبي"},{status:502,headers:{"Cache-Control":"no-store"}})}
  const secret=await resolveAdminJwtSecret();const claims=secret?await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret):null;
  await database.prepare("INSERT INTO navixa_admin_push_lab_log (id,admin_email,endpoint,kind,title,sent_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),claims?.email||"admin",endpoint,kind,title,new Date().toISOString()).run();
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
