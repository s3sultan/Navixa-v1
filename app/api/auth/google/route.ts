import {NextResponse} from "next/server";

const GOOGLE_CLIENT_ID="876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
const ADMIN_EMAIL="s2shug@gmail.com";

export async function POST(request:Request){
  try{
    const {credential}=await request.json();
    if(!credential||typeof credential!=="string")return NextResponse.json({error:"لم يصل تأكيد Google"},{status:400});
    const check=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,{cache:"no-store"});
    if(!check.ok)return NextResponse.json({error:"تعذر التحقق من حساب Google"},{status:401});
    const profile=await check.json() as {aud?:string;email?:string;email_verified?:string|boolean;exp?:string};
    const verified=profile.email_verified===true||profile.email_verified==="true";
    if(profile.aud!==GOOGLE_CLIENT_ID||!verified)return NextResponse.json({error:"حساب Google غير موثّق"},{status:401});
    if(profile.email?.toLowerCase()!==ADMIN_EMAIL)return NextResponse.json({error:"هذا الحساب غير مخوّل لدخول الإدارة"},{status:403});
    const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
    response.cookies.set("navixa_google_token",credential,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:3600});
    return response;
  }catch{return NextResponse.json({error:"حدث خطأ أثناء التحقق من الحساب"},{status:500})}
}

