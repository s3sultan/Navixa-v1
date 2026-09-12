const base64UrlToUint8Array=value=>{const padding="=".repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from(raw,char=>char.charCodeAt(0))};

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

self.addEventListener("push",event=>{
  if(!event.data)return;
  let data={};
  try{data=event.data.json()}catch{data={title:"NAVIXA",body:event.data.text()}}
  const options={
    body:data.body||"لديك تنبيه جديد",
    icon:"/navixa-mark.webp",
    badge:"/navixa-mark.webp",
    tag:data.tag||"navixa-push",
    renotify:false,
    requireInteraction:data.requireInteraction===true,
    silent:data.silent===true,
    data:{...(data.data||{url:"/"}),kind:data.kind||"general",accentColor:data.accentColor||undefined},
  };
  event.waitUntil(self.registration.showNotification(data.title||"NAVIXA",options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  let destination=self.location.origin+"/";
  try{const target=new URL(event.notification.data?.url||"/",self.location.origin);if(target.origin===self.location.origin)destination=target.href}catch{}
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){
      existing.postMessage({type:"NAVIXA_PUSH_OPEN",kind:event.notification.data?.kind||"general",accentColor:event.notification.data?.accentColor});
      try{if("navigate" in existing)await existing.navigate(destination)}catch{}
      return existing.focus();
    }
    return self.clients.openWindow(destination);
  }));
});

self.addEventListener("pushsubscriptionchange",event=>{
  event.waitUntil((async()=>{
    try{
      const configResponse=await fetch("/api/push/config",{cache:"no-store",credentials:"same-origin"});
      const config=await configResponse.json();
      if(!configResponse.ok||!config.enabled||!config.publicKey)return;
      const subscription=await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(config.publicKey)});
      const json=subscription.toJSON();
      if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)return;
      await fetch("/api/push/subscriptions",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({endpoint:json.endpoint,keys:json.keys,beforeMinutes:10,beforeMinutesList:[10],competitions:[],teams:[]})});
    }catch{}
  })());
});
