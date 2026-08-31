import webpush from "web-push";
import { readRuntimeSecrets } from "./runtimeEnv";

export type FeaturePushKind = "name_heard" | "screen_watch" | "security" | "billing" | "general";

type Subscription = { endpoint:string; p256dh:string; auth:string };
type PushPayload = {
  kind: FeaturePushKind;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  urgency?: "very-low" | "low" | "normal" | "high";
  ttl?: number;
  accentColor?: string;
};

const clampTtl=(value:number|undefined)=>Math.max(30,Math.min(86400,Number(value)||300));

export async function sendFeaturePush(subscription:Subscription,payload:PushPayload){
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY||!secrets.VAPID_PRIVATE_KEY||!secrets.VAPID_SUBJECT)return {ok:false as const,reason:"vapid_not_configured"};
  webpush.setVapidDetails(secrets.VAPID_SUBJECT,secrets.VAPID_PUBLIC_KEY,secrets.VAPID_PRIVATE_KEY);
  try{
    await webpush.sendNotification(
      {endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
      JSON.stringify({
        kind:payload.kind,
        title:payload.title.slice(0,80),
        body:payload.body.slice(0,240),
        tag:(payload.tag||`navixa-${payload.kind}`).slice(0,80),
        requireInteraction:payload.requireInteraction===true,
        silent:payload.silent===true,
        accentColor:payload.accentColor,
        data:{url:payload.url||"/"},
      }),
      {TTL:clampTtl(payload.ttl),urgency:payload.urgency||"normal",topic:(payload.tag||payload.kind).slice(0,32)}
    );
    return {ok:true as const};
  }catch(error){
    const status=error instanceof webpush.WebPushError?error.statusCode:0;
    return {ok:false as const,reason:"push_delivery_failed",status};
  }
}
