import {NextResponse} from "next/server";

const RECITER_IDS=new Set([160,174]);

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const surah=Number(searchParams.get("surah")||0);
  const reciter=Number(searchParams.get("reciter")||0);
  if(!Number.isInteger(surah)||surah<1||surah>114||!RECITER_IDS.has(reciter))return NextResponse.json({error:"طلب صوت غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    const response=await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciter}/${surah}?segments=true`,{cf:{cacheTtl:86400,cacheEverything:true} as never});
    if(!response.ok)return NextResponse.json({error:"تعذر جلب توقيتات التلاوة"},{status:502,headers:{"Cache-Control":"no-store"}});
    const data=await response.json() as {audio_file?:{audio_url?:string;timestamps?:Array<{verse_key:string;timestamp_from:number;timestamp_to:number}>}};
    if(!data.audio_file?.audio_url||!data.audio_file.timestamps)return NextResponse.json({error:"توقيتات التلاوة غير متاحة"},{status:502,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({audioUrl:data.audio_file.audio_url,timestamps:data.audio_file.timestamps},{headers:{"Cache-Control":"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"}});
  }catch{return NextResponse.json({error:"تعذر جلب تلاوة الصفحة"},{status:500,headers:{"Cache-Control":"no-store"}})}
}
