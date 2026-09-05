import { NextResponse } from "next/server.js";
import { DEFAULT_PLAN_PRICES, PLAN_PRICE_KEYS, PUBLIC_PLAN_META, normalizeHalalas } from "../../../billing/planPricing.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}

async function readPrices(database:D1Database|null){
  const prices={...DEFAULT_PLAN_PRICES};
  if(!database)return prices;
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings WHERE setting_key IN (?,?)").bind(PLAN_PRICE_KEYS.monthly,PLAN_PRICE_KEYS.sprint).all<{setting_key:string;setting_value:string}>();
  for(const row of rows.results){
    if(row.setting_key===PLAN_PRICE_KEYS.monthly)prices.monthly=normalizeHalalas(row.setting_value,DEFAULT_PLAN_PRICES.monthly);
    if(row.setting_key===PLAN_PRICE_KEYS.sprint)prices.sprint=normalizeHalalas(row.setting_value,DEFAULT_PLAN_PRICES.sprint);
  }
  return prices;
}

export async function GET(){
  const prices=await readPrices(await db());
  return NextResponse.json({
    currency:"SAR",
    plans:[
      {...PUBLIC_PLAN_META.monthly,amount:prices.monthly},
      {...PUBLIC_PLAN_META.sprint,amount:prices.sprint},
    ],
    source:"admin-verified",
  },{headers:{"Cache-Control":"no-store, max-age=0"}});
}
