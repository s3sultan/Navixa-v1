export type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
export type D1Database={prepare:(sql:string)=>D1Statement};

type Pool={price_amount:number;seats_total:number;reserved_count:number;redeemed_count:number};
type Award={id:string;price_amount:number;award_role:"first"|"random"|"last";status:"reserved"|"paid"|"expired";expires_at:string};
export const FOUNDERS_KEY="navixa_founders_sep_2026";
export const FOUNDERS_START="2026-09-19T21:00:00.000Z"; // 20 Sep 2026 00:00 Umm Al Qura
export const FOUNDERS_END="2026-09-22T20:59:59.999Z"; // 22 Sep 2026 23:59:59 Umm Al Qura
export const FOUNDERS_POOLS=[
  {price:100,seats:2},
  {price:300,seats:7},
  {price:600,seats:15},
  {price:900,seats:25},
  {price:1000,seats:10},
  {price:1200,seats:41},
] as const;

const nowIso=()=>new Date().toISOString();
const changes=(value:unknown)=>((value as {meta?:{changes?:number}})?.meta?.changes||0);
const randomIndex=(total:number)=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return bytes[0]%total;};

export async function ensureFoundersCampaign(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_founders_campaigns (campaign_key TEXT PRIMARY KEY,start_at TEXT NOT NULL,end_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_founders_pools (campaign_key TEXT NOT NULL,price_amount INTEGER NOT NULL,seats_total INTEGER NOT NULL,reserved_count INTEGER NOT NULL DEFAULT 0,redeemed_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(campaign_key,price_amount))").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_founders_awards (id TEXT PRIMARY KEY,campaign_key TEXT NOT NULL,contact TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL,price_amount INTEGER NOT NULL,award_role TEXT NOT NULL DEFAULT 'random',status TEXT NOT NULL DEFAULT 'reserved',intent_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,reserved_at TEXT NOT NULL,expires_at TEXT NOT NULL,paid_at TEXT NOT NULL DEFAULT '')").run();
  await database.prepare("ALTER TABLE navixa_founders_awards ADD COLUMN award_role TEXT NOT NULL DEFAULT 'random'").run().catch(()=>{});
  const now=nowIso();
  await database.prepare("INSERT OR IGNORE INTO navixa_founders_campaigns (campaign_key,start_at,end_at,active,created_at) VALUES (?,?,?,?,?)").bind(FOUNDERS_KEY,FOUNDERS_START,FOUNDERS_END,1,now).run();
  for(const pool of FOUNDERS_POOLS)await database.prepare("INSERT OR IGNORE INTO navixa_founders_pools (campaign_key,price_amount,seats_total,reserved_count,redeemed_count) VALUES (?,?,?,?,?)").bind(FOUNDERS_KEY,pool.price,pool.seats,0,0).run();
}

export async function foundersStatus(database:D1Database){
  await ensureFoundersCampaign(database);
  const pools=await database.prepare("SELECT price_amount,seats_total,reserved_count,redeemed_count FROM navixa_founders_pools WHERE campaign_key=? ORDER BY price_amount ASC").bind(FOUNDERS_KEY).all<Pool>();
  const total=pools.results.reduce((sum,pool)=>sum+pool.seats_total,0),used=pools.results.reduce((sum,pool)=>sum+pool.redeemed_count,0),reserved=pools.results.reduce((sum,pool)=>sum+pool.reserved_count,0);
  return {startAt:FOUNDERS_START,endAt:FOUNDERS_END,total,used,reserved,remaining:Math.max(0,total-used-reserved),pools:pools.results};
}

export async function assignFoundersAward(database:D1Database,contact:string,userId:string,intentId:string){
  await ensureFoundersCampaign(database);
  const now=Date.now();
  if(now<Date.parse(FOUNDERS_START)||now>Date.parse(FOUNDERS_END))return {ok:false as const,error:"عرض المؤسسين غير متاح في الوقت الحالي"};
  const nowText=new Date(now).toISOString();
  const expired=await database.prepare("SELECT id,price_amount FROM navixa_founders_awards WHERE campaign_key=? AND status='reserved' AND expires_at<=?").bind(FOUNDERS_KEY,nowText).all<{id:string;price_amount:number}>();
  for(const award of expired.results){await database.prepare("UPDATE navixa_founders_awards SET status='expired' WHERE id=? AND status='reserved'").bind(award.id).run();await database.prepare("UPDATE navixa_founders_pools SET reserved_count=CASE WHEN reserved_count>0 THEN reserved_count-1 ELSE 0 END WHERE campaign_key=? AND price_amount=?").bind(FOUNDERS_KEY,award.price_amount).run();}
  const previous=await database.prepare("SELECT id,price_amount,status,expires_at FROM navixa_founders_awards WHERE contact=? AND campaign_key=? LIMIT 1").bind(contact,FOUNDERS_KEY).all<Award>();
  const existing=previous.results[0];
  if(existing?.status==="paid")return {ok:false as const,error:"استُخدم عرض المؤسسين لهذا الحساب مسبقًا"};
  if(existing)return {ok:false as const,error:"تم تخصيص عرض مؤسسين سابقًا لهذا الحساب وانتهت مهلة الدفع"};
  const status=await foundersStatus(database),awardRole=status.used===0?"first":status.used===status.total-1?"last":"random";
  const poolQuery=awardRole==="random"?"SELECT price_amount,seats_total,reserved_count,redeemed_count FROM navixa_founders_pools WHERE campaign_key=? AND price_amount<>100 AND redeemed_count+reserved_count<seats_total":"SELECT price_amount,seats_total,reserved_count,redeemed_count FROM navixa_founders_pools WHERE campaign_key=? AND price_amount=100 AND redeemed_count+reserved_count<seats_total";
  const pools=await database.prepare(poolQuery).bind(FOUNDERS_KEY).all<Pool>();
  const weighted=pools.results.flatMap(pool=>Array.from({length:Math.max(0,pool.seats_total-pool.redeemed_count-pool.reserved_count)},()=>pool));
  if(!weighted.length)return {ok:false as const,error:"اكتملت جميع أسعار المؤسسين"};
  for(let attempt=0;attempt<4;attempt++){
    const pool=weighted[randomIndex(weighted.length)],reservation=await database.prepare("UPDATE navixa_founders_pools SET reserved_count=reserved_count+1 WHERE campaign_key=? AND price_amount=? AND redeemed_count+reserved_count<seats_total").bind(FOUNDERS_KEY,pool.price_amount).run();
    if(changes(reservation)===0)continue;
    const expiresAt=new Date(now+15*60_000).toISOString();
    try{await database.prepare("INSERT INTO navixa_founders_awards (id,campaign_key,contact,user_id,price_amount,award_role,status,intent_id,created_at,reserved_at,expires_at,paid_at) VALUES (?,?,?,?,?,?,'reserved',?,?,?,?,'')").bind(crypto.randomUUID(),FOUNDERS_KEY,contact,userId,pool.price_amount,awardRole,intentId,nowText,nowText,expiresAt).run();return {ok:true as const,priceAmount:pool.price_amount,expiresAt};}
    catch{await database.prepare("UPDATE navixa_founders_pools SET reserved_count=CASE WHEN reserved_count>0 THEN reserved_count-1 ELSE 0 END WHERE campaign_key=? AND price_amount=?").bind(FOUNDERS_KEY,pool.price_amount).run();return {ok:false as const,error:"لا يمكن تخصيص أكثر من عرض مؤسسين للحساب نفسه"};}
  }
  return {ok:false as const,error:"تحديث عرض المؤسسين جارٍ، حاول مرة أخرى"};
}

export async function completeFoundersAward(database:D1Database,intentId:string){
  await ensureFoundersCampaign(database);const now=nowIso();
  const rows=await database.prepare("SELECT id,price_amount,status FROM navixa_founders_awards WHERE intent_id=? AND campaign_key=? LIMIT 1").bind(intentId,FOUNDERS_KEY).all<{id:string;price_amount:number;status:string}>();const award=rows.results[0];
  if(!award||award.status!=="reserved")return false;
  const result=await database.prepare("UPDATE navixa_founders_awards SET status='paid',paid_at=? WHERE id=? AND status='reserved'").bind(now,award.id).run();
  if(changes(result)===0)return false;
  await database.prepare("UPDATE navixa_founders_pools SET redeemed_count=redeemed_count+1,reserved_count=CASE WHEN reserved_count>0 THEN reserved_count-1 ELSE 0 END WHERE campaign_key=? AND price_amount=?").bind(FOUNDERS_KEY,award.price_amount).run();return true;
}
