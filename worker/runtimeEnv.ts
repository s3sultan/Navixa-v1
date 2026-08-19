export type RuntimeSecrets={VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string;API_FOOTBALL_KEY?:string};

export async function readRuntimeSecrets():Promise<RuntimeSecrets>{
  try{
    const binding=await import("cloudflare:workers") as {env?:RuntimeSecrets};
    if(binding.env)return binding.env;
  }catch{ /* Local development has no cloudflare:workers binding. */ }
  return {
    VAPID_PUBLIC_KEY:typeof process!=="undefined"?process.env.VAPID_PUBLIC_KEY:undefined,
    VAPID_PRIVATE_KEY:typeof process!=="undefined"?process.env.VAPID_PRIVATE_KEY:undefined,
    VAPID_SUBJECT:typeof process!=="undefined"?process.env.VAPID_SUBJECT:undefined,
    API_FOOTBALL_KEY:typeof process!=="undefined"?process.env.API_FOOTBALL_KEY:undefined,
  };
}
