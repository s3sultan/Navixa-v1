const base64UrlToUint8Array=value=>{const padding="=".repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from(raw,char=>char.charCodeAt(0))};

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

const safeActions=value=>{
  if(!Array.isArray(value))return [];
  const supported=typeof Notification!=="undefined"&&Number.isFinite(Notification.maxActions)?Math.max(0,Notification.maxActions):2;
  return value.slice(0,supported).flatMap(item=>{
    const action=typeof item?.action==="string"?item.action.trim():"";
    const title=typeof item?.title==="string"?item.title.trim():"";
    return /^[a-z0-9_-]{1,32}$/i.test(action)&&title?[{action,title:title.slice(0,24)}]:[];
  });
};

self.addEventListener("push",event=>{
  if(!event.data)return;
  let data={};
  try{data=event.data.json()}catch{data={title:"NAVIXA",body:event.data.text()}}
  const actions=safeActions(data.actions);
  const options={
    body:data.body||"لديك تنبيه جديد",
    icon:"/navixa-mark.webp",
    badge:"/navixa-mark.webp",
    tag:data.tag||"navixa-push",
    renotify:false,
    requireInteraction:data.requireInteraction===true,
    silent:data.silent===true,
    data:{...(data.data||{url:"/"}),kind:data.kind||"general",priority:data.priority||"normal",accentColor:data.accentColor||undefined},
    ...(actions.length?{actions}:{}),
  };
  event.waitUntil((async()=>{
    try{
      await self.registration.showNotification(data.title||"NAVIXA",options);
    }catch(error){
      if(!actions.length)throw error;
      const fallbackOptions={...options};
      delete fallbackOptions.actions;
      await self.registration.showNotification(data.title||"NAVIXA",fallbackOptions);
    }
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const selectedAction=typeof event.action==="string"?event.action:"";
  if(selectedAction==="dismiss")return;
  const actionUrls=event.notification.data?.actionUrls&&typeof event.notification.data.actionUrls==="object"?event.notification.data.actionUrls:{};
  const requestedUrl=selectedAction&&typeof actionUrls[selectedAction]==="string"?actionUrls[selectedAction]:event.notification.data?.url||"/";
  let destination=self.location.origin+"/";
  try{const target=new URL(requestedUrl,self.location.origin);if(target.origin===self.location.origin)destination=target.href}catch{}
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){
      existing.postMessage({type:"NAVIXA_PUSH_OPEN",kind:event.notification.data?.kind||"general",priority:event.notification.data?.priority||"normal",action:selectedAction||"open",accentColor:event.notification.data?.accentColor});
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
