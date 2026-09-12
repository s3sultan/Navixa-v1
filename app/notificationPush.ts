export type NavixaPushState={supported:boolean;permission:NotificationPermission|"unsupported";subscribed:boolean};
export type NavixaPushAlertType="name"|"screen"|"focus"|"task"|"water"|"break"|"eye"|"account"|"test";

const base64UrlToBytes=(value:string)=>{
  const padded=value+"=".repeat((4-value.length%4)%4);
  const binary=atob(padded.replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
};

const supported=()=>typeof window!=="undefined"&&"Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window;

const registration=async()=>navigator.serviceWorker.register("/navixa-push-sw.js");

export async function getNavixaPushState():Promise<NavixaPushState>{
  if(!supported())return {supported:false,permission:"unsupported",subscribed:false};
  const reg=await navigator.serviceWorker.getRegistration("/")||await navigator.serviceWorker.getRegistration();
  const subscription=await reg?.pushManager.getSubscription();
  return {supported:true,permission:Notification.permission,subscribed:Boolean(subscription)};
}

export async function enableNavixaAccountPush():Promise<{ok:boolean;error?:string}>{
  if(!supported())return {ok:false,error:"تنبيهات الجهاز غير مدعومة في هذا المتصفح"};
  try{
    const permission=Notification.permission==="default"?await Notification.requestPermission():Notification.permission;
    if(permission!=="granted")return {ok:false,error:"لم تُمنح صلاحية إشعارات الجهاز"};
    const configResponse=await fetch("/api/push/config",{cache:"no-store"});
    const config=await configResponse.json().catch(()=>({})) as {enabled?:boolean;publicKey?:string};
    if(!configResponse.ok||!config.enabled||!config.publicKey)return {ok:false,error:"تنبيهات الجهاز غير مهيأة على الخادم"};
    const reg=await registration();
    let subscription=await reg.pushManager.getSubscription();
    if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToBytes(config.publicKey)});
    const response=await fetch("/api/notifications/push/subscriptions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(subscription.toJSON())});
    const result=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok)return {ok:false,error:result.error||"تعذر ربط هذا الجهاز بحساب NAVIXA"};
    return {ok:true};
  }catch{return {ok:false,error:"تعذر تفعيل تنبيهات الجهاز الآن"}}
}

export async function disableNavixaAccountPush():Promise<boolean>{
  if(!supported())return false;
  try{
    const reg=await navigator.serviceWorker.getRegistration("/")||await navigator.serviceWorker.getRegistration();
    const subscription=await reg?.pushManager.getSubscription();
    if(!subscription)return true;
    const response=await fetch("/api/notifications/push/subscriptions",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint})});
    if(!response.ok)return false;
    await subscription.unsubscribe();
    return true;
  }catch{return false}
}

export async function sendNavixaAccountPush(type:NavixaPushAlertType,detail="",url="/"):Promise<number>{
  try{
    const response=await fetch("/api/notifications/deliver",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type,detail,url}),keepalive:true});
    const result=await response.json().catch(()=>({})) as {delivered?:number};
    return response.ok&&typeof result.delivered==="number"?result.delivered:0;
  }catch{return 0}
}
