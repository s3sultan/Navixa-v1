import {NextResponse} from "next/server";
const TOKEN_PATTERN=/^\d+:[\w-]+$/;
export async function POST(request:Request){try{
  const body=await request.json();
  const name=typeof body.name==="string"?body.name:"";
  const custom=typeof body.message==="string"?body.message:"";
  const text=custom?custom.slice(0,500):name?`تنبيه: سمعنا اسمك (${name.slice(0,80)})`:"";
  if(!text)return NextResponse.json({error:"رسالة غير صالحة"},{status:400});
  const token=typeof body.token==="string"?body.token:"";
  const chatId=typeof body.chatId==="string"?body.chatId:"";
  if(!TOKEN_PATTERN.test(token)||!chatId)return NextResponse.json({error:"إعدادات تلقرام الشخصية غير مكتملة"},{status:400});
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,text})});
  if(!response.ok)return NextResponse.json({error:"تعذر إرسال التنبيه"},{status:502});
  return NextResponse.json({ok:true})
}catch{return NextResponse.json({error:"تعذر معالجة التنبيه"},{status:500})}}
