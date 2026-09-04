import {NextResponse} from "next/server.js";
import {defaultAlertPolicy,readAlertPolicy,type AlertPolicyDatabase} from "../../../worker/alertPolicy.ts";

async function db():Promise<AlertPolicyDatabase|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:AlertPolicyDatabase}}).env?.DB||null}catch{return (globalThis as {DB?:AlertPolicyDatabase}).DB||null}}

export async function GET(){
  const database=await db();
  if(!database)return NextResponse.json({policy:defaultAlertPolicy()},{headers:{"Cache-Control":"no-store"}});
  try{return NextResponse.json({policy:await readAlertPolicy(database)},{headers:{"Cache-Control":"no-store"}})}
  catch{return NextResponse.json({policy:defaultAlertPolicy()},{headers:{"Cache-Control":"no-store"}})}
}
