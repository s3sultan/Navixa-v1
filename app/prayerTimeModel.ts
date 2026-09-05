export type PrayerName="Fajr"|"Dhuhr"|"Asr"|"Maghrib"|"Isha";
export type Timings=Record<string,string>;
export type PrayerAdjustments=Partial<Record<PrayerName,number>>;

export const prayerOrder:PrayerName[]=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
export const prayerLabels:Record<PrayerName,string>={Fajr:"الفجر",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
export const defaultIqamaOffset:Record<PrayerName,number>={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};
export const RIYADH={lat:24.7136,lng:46.6753,label:"الرياض"};

export const cleanTime=(value?:string)=>value?value.split(" ")[0]:"";
export const todayKey=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
export const parseTime=(hhmm:string,base=new Date())=>{const [h,m]=cleanTime(hhmm).split(":").map(Number);const d=new Date(base);if(Number.isFinite(h)&&Number.isFinite(m))d.setHours(h,m,0,0);return d};
export const addMinutes=(date:Date,minutes:number)=>new Date(date.getTime()+minutes*60000);
export const to24=(date:Date)=>`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
export const diffMinutes=(edited:string,base:string)=>Math.round((parseTime(edited).getTime()-parseTime(base).getTime())/60000);
export const applyAdjustments=(base:Timings,adjustments:PrayerAdjustments)=>{
  const next:{[key:string]:string}={...base};
  for(const name of prayerOrder){
    next[name]=to24(addMinutes(parseTime(base[name]),adjustments[name]||0));
  }
  return next;
};
export const readAdjustments=():PrayerAdjustments=>{try{return JSON.parse(localStorage.getItem("navixa-prayer-adjustments")||"{}")||{}}catch{return {}}};
export const saveAdjustments=(value:PrayerAdjustments)=>localStorage.setItem("navixa-prayer-adjustments",JSON.stringify(value));
export const prayerApiUrl=(input:{lat?:number;lng?:number;city?:string;country?:string})=>input.lat!=null&&input.lng!=null?`/api/prayer-times?lat=${encodeURIComponent(input.lat)}&lng=${encodeURIComponent(input.lng)}`:`/api/prayer-times?city=${encodeURIComponent(input.city||"")}&country=${encodeURIComponent(input.country||"")}`;
