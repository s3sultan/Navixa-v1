import { NextResponse } from "next/server";
import { ensureFoundersCampaign, FOUNDERS_KEY } from "../../../foundersCampaign.ts";
import { resolveUserSession } from "../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};

type Honor={id:string;unlock_at:string;badge_until:string;revealed_at:string};

async function db():Promise<D1Database|null>{
  try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}
  catch{return (globalThis as {DB?:D1Database}).DB||null}
}

/**
 * لا يكشف امتياز أول مؤسس إلا بعد سبعة أيام من الدفع الموثق.
 * يبقى السجل محفوظًا داخليًا من أول لحظة، لكن لا تعرض الواجهة أي تلميح قبل unlock_at.
 */
export async function GET(request:Request){
  const database=await db();
  if(!database)return NextResponse.json({found:false},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database);
  if(!session)return NextResponse.json({found:false},{headers:{"Cache-Control":"no-store"}});
  await ensureFoundersCampaign(database);
  const rows=await database.prepare("SELECT id,unlock_at,badge_until,revealed_at FROM navixa_founders_honors WHERE campaign_key=? AND user_id=? AND honor_type='first_gold_founder' LIMIT 1").bind(FOUNDERS_KEY,session.userId).all<Honor>();
  const honor=rows.results[0];
  if(!honor)return NextResponse.json({found:false},{headers:{"Cache-Control":"no-store"}});
  const now=Date.now(),unlockAt=Date.parse(honor.unlock_at);
  if(now<unlockAt)return NextResponse.json({found:true,available:false},{headers:{"Cache-Control":"no-store"}});
  if(!honor.revealed_at)await database.prepare("UPDATE navixa_founders_honors SET revealed_at=? WHERE id=? AND revealed_at=''").bind(new Date(now).toISOString(),honor.id).run();
  return NextResponse.json({found:true,available:true,badgeUntil:honor.badge_until,title:"مؤسس NAVIXA الذهبي",message:"مكانتك محفوظة في سجل مؤسسي NAVIXA، وأصبحت مزاياك الذهبية متاحة الآن."},{headers:{"Cache-Control":"no-store"}});
}
