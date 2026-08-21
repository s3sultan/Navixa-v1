import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type Row={setting_key:string;setting_value:string};
type Env=Record<string,unknown>;

const keys=["feature_enabled","base_model_enabled","auto_language_enabled","global_learning_enabled","max_file_mb","export_pdf_enabled","export_word_enabled","tutorial_enabled","usage_notice_enabled"] as const;
type Key=(typeof keys)[number];
type Settings=Record<Key,string>;
const defaults:Settings={feature_enabled:"true",base_model_enabled:"true",auto_language_enabled:"true",global_learning_enabled:"true",max_file_mb:"250",export_pdf_enabled:"true",export_word_enabled:"true",tutorial_enabled:"true",usage_notice_enabled:"true"};
const isFlag=(value:unknown)=>value===true||value==="true";
const asMb=(value:unknown)=>{const number=Number(value);return Number.isInteger(number)&&number>=25&&number<=500?String(number):""};

async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_feature_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const now=new Date().toISOString();
  for(const key of keys)await database.prepare("INSERT OR IGNORE INTO navixa_meeting_feature_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,defaults[key],now).run();
}
async function settings(database:Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_meeting_feature_settings").all<Row>();const next={...defaults};for(const row of rows.results)if(keys.includes(row.setting_key as Key))next[row.setting_key as Key]=row.setting_value;return next;}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({settings:defaults,storage:"غير متاح"},{headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({settings:await settings(database),storage:"إعدادات فقط — لا تسجيلات ولا نصوص للمستخدمين"},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const current=await settings(database);
  const next:Settings={
    feature_enabled:String(isFlag(body.featureEnabled)),
    base_model_enabled:String(isFlag(body.baseModelEnabled)),
    auto_language_enabled:String(isFlag(body.autoLanguageEnabled)),
    global_learning_enabled:String(isFlag(body.globalLearningEnabled)),
    max_file_mb:asMb(body.maxFileMb)||current.max_file_mb,
    export_pdf_enabled:String(isFlag(body.exportPdfEnabled)),
    export_word_enabled:String(isFlag(body.exportWordEnabled)),
    tutorial_enabled:String(isFlag(body.tutorialEnabled)),
    usage_notice_enabled:String(isFlag(body.usageNoticeEnabled)),
  };
  const now=new Date().toISOString();
  for(const key of keys)await database.prepare("INSERT INTO navixa_meeting_feature_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key,next[key],now).run();
  return NextResponse.json({ok:true,message:next.feature_enabled==="true"?"تم حفظ سياسة ميزة التلخيص":"تم إيقاف صفحة التلخيص للزوار مع بقاء بياناتهم المحلية على أجهزتهم"},{headers:{"Cache-Control":"no-store"}});
}

// يمنع هذا المسار صراحةً أي حقول محتوى أو صوت أو نص؛ لا يكتب سوى مفاتيح السياسة المعرفة أعلاه.
void ({} as Env);
