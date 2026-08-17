import { NextResponse } from "next/server";

type MatchStatus="scheduled"|"live"|"finished";
type Match={id:string;league:string;home:string;away:string;kickoff:string;status:MatchStatus;homeScore:number|null;awayScore:number|null;venue:string};

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const LIVE=new Set(["1H","HT","2H","ET","BT","P","INT"]);
const FINISHED=new Set(["FT","AET","PEN","AWD","WO"]);

function demoMatches(date:string):Match[]{
  return [
    {id:`demo-${date}-1`,league:"معاينة جدول المباريات",home:"الفريق المضيف",away:"الفريق الضيف",kickoff:`${date}T18:30:00+03:00`,status:"scheduled",homeScore:null,awayScore:null,venue:"يظهر اسم الملعب عند الربط"},
    {id:`demo-${date}-2`,league:"معاينة جدول المباريات",home:"الفريق الأول",away:"الفريق الثاني",kickoff:`${date}T21:00:00+03:00`,status:"scheduled",homeScore:null,awayScore:null,venue:"الوقت معروض بتوقيت الرياض"}
  ];
}

function matchStatus(short:string):MatchStatus{
  if(LIVE.has(short))return "live";
  if(FINISHED.has(short))return "finished";
  return "scheduled";
}

function mapFixture(fixture:any):Match{
  const short=String(fixture?.fixture?.status?.short||"NS");
  return {
    id:String(fixture?.fixture?.id||crypto.randomUUID()),
    league:String(fixture?.league?.name||"مباراة"),
    home:String(fixture?.teams?.home?.name||"الفريق المضيف"),
    away:String(fixture?.teams?.away?.name||"الفريق الضيف"),
    kickoff:String(fixture?.fixture?.date||""),
    status:matchStatus(short),
    homeScore:fixture?.goals?.home??null,
    awayScore:fixture?.goals?.away??null,
    venue:String(fixture?.fixture?.venue?.name||"")
  };
}

export async function GET(request:Request){
  const date=new URL(request.url).searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
  if(!DATE.test(date))return NextResponse.json({error:"تاريخ غير صالح"},{status:400});

  const apiKey=process.env.API_FOOTBALL_KEY;
  if(!apiKey){
    const response=NextResponse.json({source:"demo",matches:demoMatches(date),message:"أضف API_FOOTBALL_KEY لتفعيل البيانات الفعلية."});
    response.headers.set("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
    return response;
  }

  try{
    const provider=await fetch(`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Asia%2FRiyadh`,{
      headers:{"x-apisports-key":apiKey,accept:"application/json"},
      cache:"no-store"
    });
    const payload=await provider.json();
    if(!provider.ok||payload?.errors&&Object.keys(payload.errors).length)throw new Error("provider");
    const response=NextResponse.json({source:"api-football",matches:(Array.isArray(payload?.response)?payload.response:[]).slice(0,24).map(mapFixture)});
    response.headers.set("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
    return response;
  }catch{
    const response=NextResponse.json({source:"demo",matches:demoMatches(date),message:"تعذر تحديث المصدر الآن؛ تظهر معاينة الجدول مؤقتًا."});
    response.headers.set("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");
    return response;
  }
}
