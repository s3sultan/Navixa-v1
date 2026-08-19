import { NextResponse } from "next/server.js";
import { readRuntimeSecrets } from "../../../../worker/runtimeEnv.ts";

export async function GET(){
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY)return NextResponse.json({enabled:false},{status:503,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({enabled:true,publicKey:secrets.VAPID_PUBLIC_KEY},{headers:{"Cache-Control":"public, max-age=300"}});
}
