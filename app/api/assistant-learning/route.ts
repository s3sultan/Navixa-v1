import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Payload={question?:unknown;response?:unknown;sensitiveConsent?:unknown};
const limiter=createMemoryRateLimiter();
const neverShare=/(?:كلمة\s*مرور|password|رمز\s*تحقق|otp|بطاقة\s*(?:بنكية|ائتمان)|credit\s*card|رقم\s*حساب|account\s*number)/i;
const potentiallySensitive=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?966|0)?5\d{8}|العنوان|عنواني|تشخيص|مرض|دواء)/i;
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_assistant_learning_contributions (id TEXT PRIMARY KEY,question_text TEXT NOT NULL,response_text TEXT NOT NULL,sensitivity TEXT NOT NULL DEFAULT 'standard',explicit_sensitive_consent INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT NOT NULL DEFAULT '')").run()}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const ip=request.headers.get("cf-connecting-ip")||"unknown";const gate=limiter.consume(`assistant-learning:${ip}`,4,60*60_000);if(!gate.allowed)return NextResponse.json({error:"وصلت حد المساهمات لهذا الوقت"},{status:429,headers:{"Retry-After":String(gate.retryAfterSeconds),"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as Payload;const question=clean(body.question,420);const response=clean(body.response,700);const sensitiveConsent=body.sensitiveConsent===true;
  if(question.length<2||response.length<2)return NextResponse.json({error:"اختر سؤالًا وردًا واضحين للمشاركة"},{status:400,headers:{"Cache-Control":"no-store"}});
  if(neverShare.test(`${question} ${response}`))return NextResponse.json({error:"لا يمكن مشاركة كلمات المرور أو الرموز أو البيانات المالية"},{status:400,headers:{"Cache-Control":"no-store"}});
  const sensitivity=potentiallySensitive.test(`${question} ${response}`)?"sensitive":"standard";
  if(sensitivity==="sensitive"&&!sensitiveConsent)return NextResponse.json({error:"تحتاج هذه المساهمة موافقة مستقلة للبيانات الحساسة"},{status:409,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);
  await database.prepare("INSERT INTO navixa_assistant_learning_contributions (id,question_text,response_text,sensitivity,explicit_sensitive_consent,status,created_at,reviewed_at) VALUES (?,?,?,?,?,'pending',?, '')").bind(crypto.randomUUID(),question,response,sensitivity,sensitiveConsent?1:0,new Date().toISOString()).run();
  return NextResponse.json({ok:true,message:"شكرًا. أُرسلت المساهمة للمراجعة قبل أن يستفيد منها أي مستخدم."},{headers:{"Cache-Control":"no-store"}});
}
