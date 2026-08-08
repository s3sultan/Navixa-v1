import {NextResponse} from "next/server";
const ALLOWED=new Set([25,27]);

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const category=Number(searchParams.get("category")||0);
  if(!ALLOWED.has(category))return NextResponse.json({error:"تصنيف غير مدعوم"},{status:400});
  try{
    const response=await fetch(`https://www.hisnmuslim.com/api/ar/${category}.json`,{cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:"تعذر جلب الأذكار"},{status:502});
    const cleaned=(await response.text()).replace(/^﻿/,"");
    const data=JSON.parse(cleaned);
    const items=Object.values(data)[0];
    return NextResponse.json({items});
  }catch{return NextResponse.json({error:"تعذر جلب الأذكار"},{status:500})}
}
