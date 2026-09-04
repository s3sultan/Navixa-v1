import {NextResponse} from "next/server.js";
import {defaultAlertPolicy,readAlertMessages,readAlertPolicy,type AlertPolicyDatabase} from "../../../worker/alertPolicy.ts";

async function db():Promise<AlertPolicyDatabase|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:AlertPolicyDatabase}}).env?.DB||null}catch{return (globalThis as {DB?:AlertPolicyDatabase}).DB||null}}

export async function GET(){
  const database=await db();
  if(!database)return NextResponse.json({policy:defaultAlertPolicy(),messages:{}},{headers:{"Cache-Control":"no-store"}});
  try{
    const [policy,messages]=await Promise.all([readAlertPolicy(database),readAlertMessages(database)]);
    return NextResponse.json({policy,messages},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({policy:defaultAlertPolicy(),messages:{}},{headers:{"Cache-Control":"no-store"}})}
}
