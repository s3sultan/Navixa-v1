export const PRAYER_LOCATION_STORAGE_KEY="navixa-prayer-location-v3";
export const PRAYER_LOCATION_EVENT="navixa:prayer-location-changed";

export type SharedPrayerLocation=
  | {mode:"coords";lat:number;lng:number;label:string;source:"device"|"fallback"}
  | {mode:"city";city:string;country:string;label:string;source:"manual"};

export const normalizePrayerLocation=(value:any):SharedPrayerLocation|null=>{
  if(!value||typeof value!=="object")return null;
  if(value.mode==="city"&&typeof value.city==="string"&&typeof value.country==="string"){
    const city=value.city.trim(),country=value.country.trim();
    if(!city||!country)return null;
    return {mode:"city",city,country,label:typeof value.label==="string"&&value.label.trim()?value.label.trim():`${city}، ${country}`,source:"manual"};
  }
  const lat=Number(value.lat),lng=Number(value.lng);
  if(Number.isFinite(lat)&&Number.isFinite(lng)){
    const source=value.source==="fallback"?"fallback":"device";
    return {mode:"coords",lat,lng,label:typeof value.label==="string"&&value.label.trim()?value.label.trim():source==="fallback"?"الرياض افتراضيًا":"موقع جهازك",source};
  }
  return null;
};

export const readSharedPrayerLocation=():SharedPrayerLocation|null=>{
  if(typeof window==="undefined")return null;
  try{
    const current=normalizePrayerLocation(JSON.parse(localStorage.getItem(PRAYER_LOCATION_STORAGE_KEY)||"null"));
    if(current)return current;
    const legacy=normalizePrayerLocation(JSON.parse(localStorage.getItem("navixa-prayer-location-v2")||"null"));
    if(legacy){localStorage.setItem(PRAYER_LOCATION_STORAGE_KEY,JSON.stringify(legacy));return legacy}
  }catch{}
  return null;
};

export const writeSharedPrayerLocation=(location:SharedPrayerLocation)=>{
  if(typeof window==="undefined")return;
  localStorage.setItem(PRAYER_LOCATION_STORAGE_KEY,JSON.stringify(location));
  if(location.mode==="coords")localStorage.setItem("navixa-prayer-location-v2",JSON.stringify({lat:location.lat,lng:location.lng,source:location.source,label:location.label}));
  else localStorage.removeItem("navixa-prayer-location-v2");
  window.dispatchEvent(new CustomEvent(PRAYER_LOCATION_EVENT,{detail:location}));
};

export const subscribePrayerLocation=(handler:(location:SharedPrayerLocation)=>void)=>{
  if(typeof window==="undefined")return()=>{};
  const onCustom=(event:Event)=>{const location=normalizePrayerLocation((event as CustomEvent).detail);if(location)handler(location)};
  const onStorage=(event:StorageEvent)=>{if(event.key!==PRAYER_LOCATION_STORAGE_KEY||!event.newValue)return;try{const location=normalizePrayerLocation(JSON.parse(event.newValue));if(location)handler(location)}catch{}};
  window.addEventListener(PRAYER_LOCATION_EVENT,onCustom as EventListener);
  window.addEventListener("storage",onStorage);
  return()=>{window.removeEventListener(PRAYER_LOCATION_EVENT,onCustom as EventListener);window.removeEventListener("storage",onStorage)};
};

export const prayerLocationRequest=(location:SharedPrayerLocation)=>location.mode==="coords"?{lat:location.lat,lng:location.lng}:{city:location.city,country:location.country};
