import webpush from "web-push";
import { readRuntimeSecrets } from "./runtimeEnv.ts";

export type FeaturePushKind = "name_heard" | "screen_watch" | "security" | "billing" | "study_suspension" | "general";
export type FeaturePushPriority = "low" | "normal" | "important" | "critical";
export type FeaturePushAction = { action:string; title:string; url?:string };

type Subscription = { endpoint:string; p256dh:string; auth:string };
type PushUrgency = "very-low" | "low" | "normal" | "high";
type PushPayload = {
  kind: FeaturePushKind;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: FeaturePushPriority;
  actions?: FeaturePushAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  urgency?: PushUrgency;
  ttl?: number;
  accentColor?: string;
};

type DeliveryProfile={urgency:PushUrgency;ttl:number;requireInteraction:boolean};

const priorityProfiles:Record<FeaturePushPriority,DeliveryProfile>={
  low:{urgency:"low",ttl:1800,requireInteraction:false},
  normal:{urgency:"normal",ttl:900,requireInteraction:false},
  important:{urgency:"high",ttl:300,requireInteraction:true},
  critical:{urgency:"high",ttl:120,requireInteraction:true},
};

const kindPriority:Record<FeaturePushKind,FeaturePushPriority>={
  name_heard:"important",
  screen_watch:"important",
  security:"critical",
  billing:"normal",
  study_suspension:"important",
  general:"normal",
};

const actionIdPattern=/^[a-z0-9_-]{1,32}$/i;
const safeRelativeUrl=(value:string|undefined)=>Boolean(value&&value.startsWith("/")&&!value.startsWith("//"));
const clampTtl=(value:number|undefined,fallback:number)=>Math.max(30,Math.min(86400,Number(value)||fallback));

export function resolveFeaturePushPriority(kind:FeaturePushKind,requested?:FeaturePushPriority){
  return requested||kindPriority[kind]||"normal";
}

function sanitizeActions(actions:FeaturePushAction[]|undefined){
  if(!Array.isArray(actions))return [] as FeaturePushAction[];
  return actions.slice(0,2).flatMap(item=>{
    const action=String(item?.action||"").trim();
    const title=String(item?.title||"").trim().slice(0,24);
    const url=typeof item?.url==="string"&&safeRelativeUrl(item.url)?item.url:undefined;
    if(!actionIdPattern.test(action)||!title)return [];
    return [{action,title,url}];
  });
}

export async function sendFeaturePush(subscription:Subscription,payload:PushPayload){
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY||!secrets.VAPID_PRIVATE_KEY||!secrets.VAPID_SUBJECT)return {ok:false as const,reason:"vapid_not_configured"};
  webpush.setVapidDetails(secrets.VAPID_SUBJECT,secrets.VAPID_PUBLIC_KEY,secrets.VAPID_PRIVATE_KEY);
  const priority=resolveFeaturePushPriority(payload.kind,payload.priority);
  const profile=priorityProfiles[priority];
  const actions=sanitizeActions(payload.actions);
  const actionUrls=Object.fromEntries(actions.flatMap(action=>action.url?[[action.action,action.url]]:[]));
  const url=safeRelativeUrl(payload.url)?payload.url:"/";
  try{
    await webpush.sendNotification(
      {endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
      JSON.stringify({
        kind:payload.kind,
        priority,
        title:payload.title.slice(0,80),
        body:payload.body.slice(0,240),
        tag:(payload.tag||`navixa-${payload.kind}`).slice(0,80),
        requireInteraction:payload.requireInteraction??profile.requireInteraction,
        silent:payload.silent===true,
        accentColor:payload.accentColor,
        actions:actions.map(({action,title})=>({action,title})),
        data:{url,actionUrls},
      }),
      {
        TTL:clampTtl(payload.ttl,profile.ttl),
        urgency:payload.urgency||profile.urgency,
        topic:(payload.tag||payload.kind).slice(0,32),
      }
    );
    return {ok:true as const};
  }catch(error){
    const status=error instanceof webpush.WebPushError?error.statusCode:0;
    return {ok:false as const,reason:"push_delivery_failed",status};
  }
}