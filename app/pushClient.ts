export type NavixaPushSubscriptionResult={
  endpoint:string;
  accountBound:boolean;
};

type PushConfig={enabled?:boolean;publicKey?:string};
type SubscriptionSaveResult={ok?:boolean;accountBound?:boolean;error?:string};

type DeviceNotificationOptions={
  body:string;
  tag?:string;
  url?:string;
  requireInteraction?:boolean;
};

function base64UrlToUint8Array(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from(raw,char=>char.charCodeAt(0));
}

export function isIOSWebKitDevice(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
}

export function isStandaloneWebApp(){
  return window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
}

async function saveSubscription(subscription:PushSubscription):Promise<NavixaPushSubscriptionResult>{
  const json=subscription.toJSON();
  if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw new Error("تعذر قراءة بيانات اشتراك Push من الجهاز.");
  const response=await fetch("/api/push/subscriptions",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    credentials:"same-origin",
    body:JSON.stringify({
      endpoint:json.endpoint,
      keys:json.keys,
      beforeMinutes:10,
      beforeMinutesList:[10],
      competitions:[],
      teams:[],
    }),
  });
  const result=await response.json().catch(()=>({})) as SubscriptionSaveResult;
  if(!response.ok)throw new Error(result.error||"تعذر حفظ اشتراك Push.");
  return {endpoint:json.endpoint,accountBound:result.accountBound===true};
}

export async function ensureNavixaPushSubscription(options:{requestPermission?:boolean}={}):Promise<NavixaPushSubscriptionResult|null>{
  if(typeof window==="undefined")return null;
  if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("هذا الجهاز لا يدعم Push في الوضع الحالي.");
  if(isIOSWebKitDevice()&&!isStandaloneWebApp())throw new Error("على iPhone ثبّت NAVIXA على الشاشة الرئيسية وافتحه من الأيقونة لتفعيل Push.");

  let permission=Notification.permission;
  if(permission==="default"&&options.requestPermission===true)permission=await Notification.requestPermission();
  if(permission==="default")return null;
  if(permission!=="granted")throw new Error("صلاحية إشعارات NAVIXA غير مفعّلة من النظام.");

  await navigator.serviceWorker.register("/navixa-push-sw.js",{scope:"/"});
  const registration=await navigator.serviceWorker.ready;
  const configResponse=await fetch("/api/push/config",{cache:"no-store",credentials:"same-origin"});
  const config=await configResponse.json().catch(()=>({})) as PushConfig;
  if(!configResponse.ok||!config.enabled||!config.publicKey)throw new Error("خدمة Push غير مهيأة حاليًا.");

  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){
    subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(config.publicKey),
    });
  }
  return saveSubscription(subscription);
}

export async function syncExistingNavixaPushSubscription(){
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return null;
  try{return await ensureNavixaPushSubscription({requestPermission:false})}catch{return null}
}

export async function showNavixaDeviceNotification(title:string,options:DeviceNotificationOptions){
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator))return false;
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification(title,{
    body:options.body,
    tag:options.tag||"navixa-device",
    icon:"/navixa-mark.webp",
    badge:"/navixa-mark.webp",
    requireInteraction:options.requireInteraction===true,
    data:{url:options.url||"/"},
  });
  return true;
}

export async function sendNavixaPushTest(endpoint:string){
  const response=await fetch("/api/push/test",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    credentials:"same-origin",
    body:JSON.stringify({endpoint}),
  });
  const result=await response.json().catch(()=>({})) as {ok?:boolean;error?:string};
  if(!response.ok)throw new Error(result.error||"تعذر إرسال اختبار Push.");
  return result;
}
