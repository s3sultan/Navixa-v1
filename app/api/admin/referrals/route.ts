import { NextResponse } from "next/server.js";
import {ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken} from "../../../../worker/adminAuth.ts";
import {clean,createReferralProfile,ensureReferralSchema,readReferralSettings,referralDefaults} from "../../../referrals.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Profile={id:string;contact:string;display_name:string;referral_code:string;status:string;created_at:string};
type Reward={id:string;plan:string;reward_days:number;status:string;created_at:string;referrer_contact:string;referrer_code:string;referred_contact:string};
type Attribution={id:string;referral_code:string;referred_contact:string;status:string;created_at:string;expires_at:string};
const int=(value:unknown,min:number,max:number,fallback:number)=>Math.max(min,Math.min(max,Number.parseInt(clean(value,4),10)||fallback));
const flag=(value:unknown)=>value===true||value==="true";
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({settings:referralDefaults,profiles:[],attributions:[],rewards:[]},{headers:{"Cache-Control":"no-store"}});await ensureReferralSchema(database);const [settings,profiles,attributions,rewards]=await Promise.all([
    readReferralSettings(database),
    database.prepare("SELECT id,contact,display_name,referral_code,status,created_at FROM navixa_referral_profiles ORDER BY created_at DESC LIMIT 50").all<Profile>(),
    database.prepare("SELECT id,referral_code,referred_contact,status,created_at,expires_at FROM navixa_referral_attributions ORDER BY created_at DESC LIMIT 50").all<Attribution>(),
    database.prepare("SELECT r.id,r.plan,r.reward_days,r.status,r.created_at,p.contact AS referrer_contact,p.referral_code,a.referred_contact FROM navixa_referral_rewards r JOIN navixa_referral_profiles p ON p.id=r.referrer_profile_id JOIN navixa_referral_attributions a ON a.id=r.attribution_id ORDER BY r.created_at DESC LIMIT 50").all<Reward>(),
  ]);
  return NextResponse.json({settings,profiles:profiles.results,attributions:attributions.results,rewards:rewards.results},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await ensureReferralSchema(database);const body=await request.json().catch(()=>({})) as {action?:unknown;contact?:unknown;displayName?:unknown;enabled?:unknown;monthlyRewardDays?:unknown;quarterlyRewardDays?:unknown;maxRewardsPerMonth?:unknown;attributionDays?:unknown;rewardId?:unknown;profileId?:unknown;profileStatus?:unknown};const action=clean(body.action,24),now=new Date().toISOString();
  if(action==="create_profile"){try{const profile=await createReferralProfile(database,clean(body.contact,160),clean(body.displayName,80));return NextResponse.json({ok:true,profile,message:`تم تجهيز رابط إحالة للمستخدم: ${profile.referral_code}`},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"تعذر إنشاء رمز الإحالة"},{status:400})}}
  if(action==="save_settings"){const values={enabled:String(flag(body.enabled)),monthly_reward_days:String(int(body.monthlyRewardDays,1,90,7)),quarterly_reward_days:String(int(body.quarterlyRewardDays,1,180,14)),max_rewards_per_month:String(int(body.maxRewardsPerMonth,1,20,4)),attribution_days:String(int(body.attributionDays,1,90,30))};for(const [key,value] of Object.entries(values))await database.prepare("INSERT INTO navixa_referral_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key,value,now).run();return NextResponse.json({ok:true,message:values.enabled==="true"?"تم فتح حملة الإحالات داخل النظام. ستبقى واجهة المشاركة مخفية حتى تفتحها لاحقًا.":"تم حفظ الإعدادات مع إبقاء الإحالات مقفلة"},{headers:{"Cache-Control":"no-store"}})}
  if(action==="set_profile_status"){const id=clean(body.profileId,80),status=clean(body.profileStatus,12);if(!id||!["active","paused"].includes(status))return NextResponse.json({error:"بيانات الرمز غير صالحة"},{status:400});await database.prepare("UPDATE navixa_referral_profiles SET status=?,updated_at=? WHERE id=?").bind(status,now,id).run();return NextResponse.json({ok:true,message:status==="active"?"تم تشغيل رمز الإحالة":"تم إيقاف رمز الإحالة"},{headers:{"Cache-Control":"no-store"}})}
  if(action==="delete_profile"){const id=clean(body.profileId,80);if(!id)return NextResponse.json({error:"معرف الرمز مطلوب"},{status:400});const used=await database.prepare("SELECT id FROM navixa_referral_attributions WHERE referrer_profile_id=? LIMIT 1").bind(id).all();if(used.results.length)return NextResponse.json({error:"لا يمكن حذف رمز استُخدم؛ أوقفه بدلًا من ذلك"},{status:409});await database.prepare("DELETE FROM navixa_referral_profiles WHERE id=?").bind(id).run();return NextResponse.json({ok:true,message:"تم حذف رمز الإحالة غير المستخدم"},{headers:{"Cache-Control":"no-store"}})}
  if(action==="reverse_reward"){const id=clean(body.rewardId,80);if(!id)return NextResponse.json({error:"معرف المكافأة مطلوب"},{status:400});await database.prepare("UPDATE navixa_referral_rewards SET status='reversed',reversed_at=?,updated_at=? WHERE id=? AND status='pending_credit'").bind(now,now,id).run();return NextResponse.json({ok:true,message:"تم عكس المكافأة المعلقة قبل تطبيقها"},{headers:{"Cache-Control":"no-store"}})}
  return NextResponse.json({error:"إجراء غير صالح"},{status:400});
}
