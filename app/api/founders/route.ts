import { NextResponse } from "next/server";
import { assignFoundersAward, foundersStatus } from "../../foundersCampaign.ts";
import { resolveUserSession, trustedUserMutation } from "../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};

async function db():Promise<D1Database|null>{
  try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}
  catch{return (globalThis as {DB?:D1Database}).DB||null}
}

/**
 * GET /api/founders
 * يعرض حالة عامة للحملة. لا يكشف توزيع الأسعار أو هوية الفائزين.
 */
export async function GET(){
  const database=await db();
  if(!database)return NextResponse.json({available:false,message:"حملة المؤسسين غير مهيأة"},{status:503,headers:{"Cache-Control":"no-store"}});
  const status=await foundersStatus(database);
  const now=Date.now(),active=now>=Date.parse(status.startAt)&&now<=Date.parse(status.endAt)&&status.remaining>0;
  return NextResponse.json({
    available:active,
    startAt:status.startAt,
    endAt:status.endAt,
    totalSeats:status.total,
    paidSeats:status.used,
    reservedSeats:status.reserved,
    remainingSeats:status.remaining,
    message:active?"توجد فرص مؤسسين محدودة متاحة الآن":"حملة المؤسسين غير متاحة حاليًا",
  },{headers:{"Cache-Control":"no-store"}});
}

/**
 * POST /api/founders
 * يخصص سعر مؤسس واحد للحساب الموثق لمدة 15 دقيقة.
 * لا يخصم مقعدًا مدفوعًا إلا بعد أن يستدعي Moyasar Webhook completeFoundersAward(intentId).
 */
export async function POST(request:Request){
  if(!trustedUserMutation(request))return NextResponse.json({error:"طلب غير مسموح"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();
  if(!database)return NextResponse.json({error:"الحملة غير مهيأة"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database);
  if(!session)return NextResponse.json({error:"سجّل الدخول بالبريد الموثق أولًا"},{status:401,headers:{"Cache-Control":"no-store"}});
  const intentId=crypto.randomUUID();
  const award=await assignFoundersAward(database,session.email,session.userId,intentId);
  if(!award.ok)return NextResponse.json({error:award.error},{status:409,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({
    ok:true,
    foundersIntentId:intentId,
    priceHalalas:award.priceAmount,
    priceSar:(award.priceAmount/100).toFixed(2),
    expiresAt:award.expiresAt,
    renewalPriceSar:"19.00",
    note:"هذا سعر مؤسس لأول شهر فقط. التجديد اللاحق بالسعر المعلن 19 ر.س، ويظهر قبل الدفع.",
  },{headers:{"Cache-Control":"no-store"}});
}
