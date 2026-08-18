import { NextResponse } from "next/server.js";

type MatchStatus="scheduled"|"live"|"finished";
type Competition={id:string;label:string};
type Match={id:string;league:string;competitionId:string;home:string;away:string;homeLogo:string;awayLogo:string;kickoff:string;status:MatchStatus;homeScore:number|null;awayScore:number|null;venue:string};

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const LIVE=new Set(["1H","HT","2H","ET","BT","P","INT"]);
const FINISHED=new Set(["FT","AET","PEN","AWD","WO"]);
const FEATURED_BY_LEAGUE_ID:Record<number,Competition>={
  307:{id:"rsl",label:"دوري روشن السعودي"},
  39:{id:"premier-league",label:"الدوري الإنجليزي الممتاز"},
  140:{id:"la-liga",label:"الدوري الإسباني"},
  78:{id:"bundesliga",label:"الدوري الألماني"},
  135:{id:"serie-a",label:"الدوري الإيطالي"},
  61:{id:"ligue-1",label:"الدوري الفرنسي"},
  2:{id:"champions-league",label:"دوري أبطال أوروبا"}
};

function matchStatus(short:string):MatchStatus{
  if(LIVE.has(short))return "live";
  if(FINISHED.has(short))return "finished";
  return "scheduled";
}

function featuredCompetition(fixture:any):Competition|undefined{
  const leagueId=Number(fixture?.league?.id);
  if(FEATURED_BY_LEAGUE_ID[leagueId])return FEATURED_BY_LEAGUE_ID[leagueId];
  const name=String(fixture?.league?.name||"").toLowerCase();
  const country=String(fixture?.league?.country||"").toLowerCase();
  // The country condition prevents the Iranian Persian Gulf Pro League from being labelled as Saudi Roshn League.
  if(country.includes("saudi")&&name.includes("king")&&name.includes("cup"))return {id:"kings-cup",label:"كأس الملك"};
  if(name.includes("gulf cup")||name.includes("gulf cup of nations"))return {id:"gulf-cup",label:"كأس الخليج"};
  return undefined;
}

function mapFixture(fixture:any,competition:Competition):Match{
  const short=String(fixture?.fixture?.status?.short||"NS");
  return {
    id:String(fixture?.fixture?.id||crypto.randomUUID()),
    league:competition.label,
    competitionId:competition.id,
    home:String(fixture?.teams?.home?.name||"الفريق المضيف"),
    away:String(fixture?.teams?.away?.name||"الفريق الضيف"),
    homeLogo:String(fixture?.teams?.home?.logo||""),
    awayLogo:String(fixture?.teams?.away?.logo||""),
    kickoff:String(fixture?.fixture?.date||""),
    status:matchStatus(short),
    homeScore:fixture?.goals?.home??null,
    awayScore:fixture?.goals?.away??null,
    venue:String(fixture?.fixture?.venue?.name||"")
  };
}

function fallback(date:string,message:string,cacheControl:string){
  const response=NextResponse.json({source:"unavailable",matches:[],date,message});
  response.headers.set("Cache-Control",cacheControl);
  return response;
}

export async function GET(request:Request){
  const date=new URL(request.url).searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
  if(!DATE.test(date))return NextResponse.json({error:"تاريخ غير صالح"},{status:400});

  const apiKey=process.env.API_FOOTBALL_KEY;
  if(!apiKey)return fallback(date,"مصدر المباريات غير مفعّل حاليًا.","public, s-maxage=300, stale-while-revalidate=900");

  try{
    const provider=await fetch(`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Asia%2FRiyadh`,{
      headers:{"x-apisports-key":apiKey},
      cache:"no-store"
    });
    const payload=await provider.json();
    if(!provider.ok||payload?.errors&&Object.keys(payload.errors).length)throw new Error("provider");
    const matches=(Array.isArray(payload?.response)?payload.response:[])
      .map((fixture:any)=>{const competition=featuredCompetition(fixture);return competition?mapFixture(fixture,competition):null})
      .filter((match:Match|null):match is Match=>Boolean(match))
      .slice(0,36);
    const response=NextResponse.json({source:"api-football",matches});
    response.headers.set("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
    return response;
  }catch{
    return fallback(date,"تعذر تحديث مصدر المباريات الآن؛ لن تظهر مباريات غير مؤكدة.","public, s-maxage=300, stale-while-revalidate=900");
  }
}
