import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type CodeRow={id:string;code:string;discount_type:string;discount_value:number;plans:string;max_redemptions:number;redeemed_count:number;valid_from:string;valid_until:string;enabled:number;created_at:string;updated_at:string};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const code=(value:unknown)=>clean(value,32).toUpperCase().replace(/[^A-Z0-9_-]/g,"");
const db=async():Promise<D1Database|null>=>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}};
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_discount_codes (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,discount_type TEXT NOT NULL DEFAULT 'percent',discount_value INTEGER NOT NULL DEFAULT 0,plans TEXT NOT NULL DEFAULT 'all',max_redemptions INTEGER NOT NULL DEFAULT 0,redeemed_count INTEGER NOT NULL DEFAULT 0,valid_from TEXT NOT NULL DEFAULT '',valid_until TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
}
export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401});
  const database=await db();if(!database)return NextResponse.json({codes:[]});await schema(database);
  const rows=await database.prepare("SELECT id,code,discount_type,discount_value,plans,max_redemptions,redeemed_count,valid_from,valid_until,enabled,created_at,updated_at FROM navixa_discount_codes ORDER BY created_at DESC LIMIT 200").all<CodeRow>();
  return NextResponse.json({codes:rows.results},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503});await schema(database);
  const body=await request.json().catch(()=>({})) as {action?:unknown;id?:unknown;code?:unknown;discountType?:unknown;discountValue?:unknown;plans?:unknown;maxRedemptions?:unknown;validFrom?:unknown;validUntil?:unknown;enabled?:unknown};
  const action=clean(body.action,20),now=new Date().toISOString();
  if(action==="toggle"){const id=clean(body.id,80);await database.prepare("UPDATE navixa_discount_codes SET enabled=CASE WHEN enabled=1 THEN 0 ELSE 1 END,updated_at=? WHERE id=?").bind(now,id).run();return NextResponse.json({ok:true,message:"تم تحديث حالة كود الخصم"});}
  if(action!=="create")return NextResponse.json({error:"إجراء غير صالح"},{status:400});
  const value=code(body.code),type=body.discountType==="fixed"?"fixed":"percent",discountValue=Math.max(1,Math.min(type==="percent"?100:100000,Number.parseInt(String(body.discountValue||0),10)||0)),plans=["monthly","quarterly","all"].includes(String(body.plans))?String(body.plans):"all",max=Math.max(0,Math.min(100000,Number.parseInt(String(body.maxRedemptions||0),10)||0)),from=clean(body.validFrom,32),until=clean(body.validUntil,32);
  if(value.length<4||discountValue<1)return NextResponse.json({error:"أدخل كودًا وقيمة خصم صحيحة"},{status:400});
  if(until&&from&&new Date(until).getTime()<new Date(from).getTime())return NextResponse.json({error:"تاريخ الانتهاء يسبق تاريخ البداية"},{status:400});
  try{await database.prepare("INSERT INTO navixa_discount_codes (id,code,discount_type,discount_value,plans,max_redemptions,redeemed_count,valid_from,valid_until,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?,1,?,?)").bind(crypto.randomUUID(),value,type,discountValue,plans,max,from,until,now,now).run();return NextResponse.json({ok:true,message:"تم إنشاء كود الخصم"});}catch{return NextResponse.json({error:"الكود موجود مسبقًا أو غير صالح"},{status:409});}
}
