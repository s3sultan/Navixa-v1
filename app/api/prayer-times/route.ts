import {NextResponse} from "next/server";

const supportedMethods=new Set([3,4,8,9,10]);
const datePattern=/^\d{2}-\d{2}-\d{4}$/;
const finite=(value:string|null)=>{const number=Number(value);return Number.isFinite(number)?number:null};

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const latRaw=searchParams.get("lat"),lngRaw=searchParams.get("lng"),city=searchParams.get("city")?.trim(),country=searchParams.get("country")?.trim();
  const lat=finite(latRaw),lng=finite(lngRaw);
  const requestedMethod=Number(searchParams.get("method")||4);
  const method=supportedMethods.has(requestedMethod)?requestedMethod:4;
  const requestedDate=searchParams.get("date")?.trim()||"";
  if(requestedDate&&!datePattern.test(requestedDate))return NextResponse.json({error:"تاريخ غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  if((latRaw||lngRaw)&&(lat===null||lng===null||lat<-90||lat>90||lng<-180||lng>180))return NextResponse.json({error:"إحداثيات غير صالحة"},{status:400,headers:{"Cache-Control":"no-store"}});
  const datePath=requestedDate?`/${requestedDate}`:"";
  const url=lat!==null&&lng!==null
    ?`https://api.aladhan.com/v1/timings${datePath}?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&method=${method}`
    :city&&country
    ?`https://api.aladhan.com/v1/timingsByCity${datePath}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`
    :null;
  if(!url)return NextResponse.json({error:"الموقع مطلوب"},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:"تعذر جلب مواقيت الصلاة"},{status:502,headers:{"Cache-Control":"no-store"}});
    const payload=await response.json();
    const result=NextResponse.json(payload);
    result.headers.set("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");
    return result;
  }catch{return NextResponse.json({error:"تعذر جلب مواقيت الصلاة"},{status:500,headers:{"Cache-Control":"no-store"}})}
}
