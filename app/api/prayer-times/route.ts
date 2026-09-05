import {NextResponse} from "next/server";

const METHOD=4; // Umm Al-Qura University, Makkah

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const lat=searchParams.get("lat"),lng=searchParams.get("lng"),city=searchParams.get("city"),country=searchParams.get("country");
  const url=lat&&lng
    ?`https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&method=${METHOD}&school=0`
    :city&&country
    ?`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${METHOD}&school=0`
    :null;
  if(!url)return NextResponse.json({error:"الموقع مطلوب"},{status:400});
  try{
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:"تعذر جلب مواقيت الصلاة"},{status:502});
    const payload=await response.json();
    const result=NextResponse.json({...payload,navixa:{calculation:"Umm Al-Qura University, Makkah",method:METHOD}});
    result.headers.set("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");
    return result;
  }catch{return NextResponse.json({error:"تعذر جلب مواقيت الصلاة"},{status:500})}
}
