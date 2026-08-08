import {NextResponse} from "next/server";

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const page=Number(searchParams.get("page")||0);
  if(!page||page<1||page>604)return NextResponse.json({error:"رقم صفحة غير صالح"},{status:400});
  try{
    const response=await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`,{cache:"no-store"});
    if(!response.ok)return NextResponse.json({error:"تعذر جلب صفحة القرآن"},{status:502});
    return NextResponse.json(await response.json());
  }catch{return NextResponse.json({error:"تعذر جلب صفحة القرآن"},{status:500})}
}
