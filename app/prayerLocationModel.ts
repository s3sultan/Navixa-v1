export const PRAYER_LOCATION_STORAGE_KEY="navixa-prayer-location-v3";
export const PRAYER_LOCATION_EVENT="navixa:prayer-location-changed";
const LEGACY_PRAYER_LOCATION_STORAGE_KEY="navixa-prayer-location-v2";

export type SharedPrayerLocation=
  | {mode:"coords";lat:number;lng:number;label:string;source:"device"|"fallback"}
  | {mode:"city";city:string;country:string;label:string;source:"manual"};

let sessionPrayerLocation:SharedPrayerLocation|null=null;

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

const persistCityPrayerLocation=(location:Extract<SharedPrayerLocation,{mode:"city"}>)=>{
  localStorage.setItem(PRAYER_LOCATION_STORAGE_KEY,JSON.stringify({
    mode:"city",
    city:location.city,
    country:location.country,
    label:location.label,
    source:"manual",
  }));
};

export const readSharedPrayerLocation=():SharedPrayerLocation|null=>{
  if(typeof window==="undefined")return null;
  if(sessionPrayerLocation?.mode==="coords")return sessionPrayerLocation;
  try{
    const current=normalizePrayerLocation(JSON.parse(localStorage.getItem(PRAYER_LOCATION_STORAGE_KEY)||"null"));
    if(current?.mode==="coords"){
      // Precise device coordinates are deliberately session-memory only.
      localStorage.removeItem(PRAYER_LOCATION_STORAGE_KEY);
    }else if(current){
      sessionPrayerLocation=current;
      localStorage.removeItem(LEGACY_PRAYER_LOCATION_STORAGE_KEY);
      return current;
    }

    const legacy=normalizePrayerLocation(JSON.parse(localStorage.getItem(LEGACY_PRAYER_LOCATION_STORAGE_KEY)||"null"));
    localStorage.removeItem(LEGACY_PRAYER_LOCATION_STORAGE_KEY);
    if(legacy?.mode==="city"){
      persistCityPrayerLocation(legacy);
      sessionPrayerLocation=legacy;
      return legacy;
    }
  }catch{}
  return sessionPrayerLocation;
};

export const writeSharedPrayerLocation=(location:SharedPrayerLocation)=>{
  if(typeof window==="undefined")return;
  sessionPrayerLocation=location;
  if(location.mode==="city")persistCityPrayerLocation(location);
  else localStorage.removeItem(PRAYER_LOCATION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_PRAYER_LOCATION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PRAYER_LOCATION_EVENT,{detail:location}));
};

export const subscribePrayerLocation=(handler:(location:SharedPrayerLocation)=>void)=>{
  if(typeof window==="undefined")return()=>{};
  const onCustom=(event:Event)=>{const location=normalizePrayerLocation((event as CustomEvent).detail);if(location)handler(location)};
  const onStorage=(event:StorageEvent)=>{
    if(event.key!==PRAYER_LOCATION_STORAGE_KEY||!event.newValue)return;
    try{
      const location=normalizePrayerLocation(JSON.parse(event.newValue));
      if(!location)return;
      if(location.mode==="coords"){
        localStorage.removeItem(PRAYER_LOCATION_STORAGE_KEY);
        return;
      }
      sessionPrayerLocation=location;
      handler(location);
    }catch{}
  };
  window.addEventListener(PRAYER_LOCATION_EVENT,onCustom as EventListener);
  window.addEventListener("storage",onStorage);
  return()=>{window.removeEventListener(PRAYER_LOCATION_EVENT,onCustom as EventListener);window.removeEventListener("storage",onStorage)};
};

export const prayerLocationRequest=(location:SharedPrayerLocation)=>location.mode==="coords"?{lat:location.lat,lng:location.lng}:{city:location.city,country:location.country};
