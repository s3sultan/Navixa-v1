import webpush from "web-push";
import { readRuntimeSecrets } from "./runtimeEnv";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database={prepare:(sql:string)=>D1Statement};
type PushEnv={DB:D1Database};
type PushSubscriptionRow={id:string;endpoint:string;p256dh:string;auth:string;competitions_json:string;teams_json:string;before_minutes:number;before_minutes_json?:string};
type Fixture={id:string;competitionId:string;league:string;home:string;away:string;kickoff:string};

const REFRESH_MS=15*60*1000;
const FEATURED:Record<number,{id:string;label:string}>={307:{id:"rsl",label:"دوري روشن السعودي"},39:{id:"premier-league",label:"الدوري الإنجليزي الممتاز"},140:{id:"la-liga",label:"الدوري الإسباني"},78:{id:"bundesliga",label:"الدوري الألماني"},135:{id:"serie-a",label:"الدوري الإيطالي"},61:{id:"ligue-1",label:"الدوري الفرنسي"},2:{id:"champions-league",label:"دوري أبطال أوروبا"}};
const toArray=(value:string)=>{try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==="string").slice(0,16):[]}catch{return []}};
const toAlertMinutes=(value:string|undefined,fallback:number)=>{try{const parsed=JSON.parse(value||"[]");const minutes=Array.isArray(parsed)?parsed.map(Number).filter(item=>[0,5,10,15,30].includes(item)):[];return [...new Set(minutes)].sort((a,b)=>b-a)}catch{return [Math.max(0,Math.min(30,Number(fallback)||0))]}};
const normalize=(value:string)=>value.trim().toLocaleLowerCase("ar").replace(/[\s-]+/g," ");
const dateKey=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
function competitionOf(fixture:any){const id=Number(fixture?.league?.id);if(FEATURED[id])return FEATURED[id];const name=String(fixture?.league?.name||"").toLowerCase();const country=String(fixture?.league?.country||"").toLowerCase();if(country.includes("saudi")&&name.includes("king")&&name.includes("cup"))return {id:"kings-cup",label:"كأس الملك"};if(name.includes("gulf cup")||name.includes("gulf cup of nations"))return {id:"gulf-cup",label:"كأس الخليج"};return null}
async function cachedFixtures(db:D1Database){const result=await db.prepare("SELECT fixture_id,competition_id,league_name,home_name,away_name,kickoff FROM navixa_push_fixture_cache WHERE kickoff>=? AND kickoff<=? ORDER BY kickoff LIMIT 100").bind(new Date(Date.now()-5*60000).toISOString(),new Date(Date.now()+48*60*60000).toISOString()).all<{fixture_id:string;competition_id:string;league_name:string;home_name:string;away_name:string;kickoff:string}>();return result.results.map(row=>({id:row.fixture_id,competitionId:row.competition_id,league:row.league_name,home:row.home_name,away:row.away_name,kickoff:row.kickoff}))}
async function sharedManualFixtures(db:D1Database):Promise<Fixture[]>{try{const result=await db.prepare("SELECT match_id,competition_id,league_name,home_name,away_name,kickoff FROM navixa_admin_manual_matches WHERE kickoff>=? AND kickoff<=? AND status='scheduled' ORDER BY kickoff LIMIT 100").bind(new Date(Date.now()-5*60000).toISOString(),new Date(Date.now()+48*60*60000).toISOString()).all<{match_id:string;competition_id:string;league_name:string;home_name:string;away_name:string;kickoff:string}>();return result.results.map(row=>({id:row.match_id,competitionId:row.competition_id,league:row.league_name,home:row.home_name,away:row.away_name,kickoff:row.kickoff}));}catch{return []}}
async function refreshFixtureCache(db:D1Database){const prior=await db.prepare("SELECT state_value FROM navixa_push_runtime_state WHERE state_key='fixture_refresh_at' LIMIT 1").all<{state_value:string}>();const refreshedAt=Date.parse(prior.results[0]?.state_value||"");if(Number.isFinite(refreshedAt)&&Date.now()-refreshedAt<REFRESH_MS)return cachedFixtures(db);const secrets=await readRuntimeSecrets();if(!secrets.API_FOOTBALL_KEY)return cachedFixtures(db);try{const response=await fetch("https://v3.football.api-sports.io/fixtures?next=100&timezone=Asia%2FRiyadh",{headers:{"x-apisports-key":secrets.API_FOOTBALL_KEY}});const payload=await response.json() as {response?:any[]};if(!response.ok||!Array.isArray(payload.response))throw new Error("provider");const now=new Date().toISOString();await db.prepare("DELETE FROM navixa_push_fixture_cache WHERE kickoff<?").bind(new Date(Date.now()-6*60*60000).toISOString()).run();for(const raw of payload.response){const competition=competitionOf(raw);const id=String(raw?.fixture?.id||"");const kickoff=String(raw?.fixture?.date||"");if(!competition||!id||!kickoff)continue;await db.prepare("INSERT INTO navixa_push_fixture_cache (fixture_id,competition_id,league_name,home_name,away_name,kickoff,refreshed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(fixture_id) DO UPDATE SET competition_id=excluded.competition_id,league_name=excluded.league_name,home_name=excluded.home_name,away_name=excluded.away_name,kickoff=excluded.kickoff,refreshed_at=excluded.refreshed_at").bind(id,competition.id,competition.label,String(raw?.teams?.home?.name||"الفريق المضيف"),String(raw?.teams?.away?.name||"الفريق الضيف"),kickoff,now).run()}await db.prepare("INSERT INTO navixa_push_runtime_state (state_key,state_value,updated_at) VALUES ('fixture_refresh_at',?,?) ON CONFLICT(state_key) DO UPDATE SET state_value=excluded.state_value,updated_at=excluded.updated_at").bind(now,now).run()}catch{/* Keep prior cache and retry after the short interval. */}return cachedFixtures(db)}
function wantsFixture(subscription:PushSubscriptionRow,fixture:Fixture){const competitions=toArray(subscription.competitions_json);const teams=toArray(subscription.teams_json).map(normalize);if(competitions.length&&!competitions.includes(fixture.competitionId))return false;if(!teams.length)return true;return teams.some(team=>[fixture.home,fixture.away].map(normalize).some(name=>name===team||name.includes(team)||team.includes(name)))}
async function deliveryExists(db:D1Database,subscriptionId:string,fixtureId:string,before:number){const result=await db.prepare("SELECT 1 AS present FROM navixa_push_deliveries WHERE subscription_id=? AND fixture_id=? AND before_minutes=? LIMIT 1").bind(subscriptionId,fixtureId,before).all<{present:number}>();return result.results.length>0}
async function track(db:D1Database,subscriptionId:string,fixtureId:string,before:number){await db.prepare("INSERT OR IGNORE INTO navixa_push_deliveries (subscription_id,fixture_id,before_minutes,sent_at) VALUES (?,?,?,?)").bind(subscriptionId,fixtureId,before,new Date().toISOString()).run();await db.prepare("INSERT INTO navixa_match_analytics_daily (day,metric,fixture_id,total) VALUES (?,?,?,1) ON CONFLICT(day,metric,fixture_id) DO UPDATE SET total=total+1").bind(dateKey(),"push_sent",fixtureId).run()}

export async function deliverDueMatchPushes(env:PushEnv){
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY||!secrets.VAPID_PRIVATE_KEY||!secrets.VAPID_SUBJECT)return {delivered:0,skipped:"vapid"};
  const result=await env.DB.prepare("SELECT id,endpoint,p256dh,auth,competitions_json,teams_json,before_minutes,before_minutes_json FROM navixa_push_subscriptions WHERE enabled=1 LIMIT 200").all<PushSubscriptionRow>();
  if(!result.results.length)return {delivered:0,skipped:"subscriptions"};
  const fixtures=[...await refreshFixtureCache(env.DB),...await sharedManualFixtures(env.DB)].filter((fixture,index,items)=>items.findIndex(item=>item.id===fixture.id)===index);
  if(!fixtures.length)return {delivered:0,skipped:"fixtures"};
  webpush.setVapidDetails(secrets.VAPID_SUBJECT,secrets.VAPID_PUBLIC_KEY,secrets.VAPID_PRIVATE_KEY);
  let delivered=0;
  const now=Date.now();
  for(const fixture of fixtures){
    const kickoff=Date.parse(fixture.kickoff);
    for(const subscription of result.results){
      if(!wantsFixture(subscription,fixture))continue;
      for(const before of toAlertMinutes(subscription.before_minutes_json,subscription.before_minutes)){
        const dueAt=kickoff-before*60000;
        if(dueAt>now||now-dueAt>75000)continue;
        if(await deliveryExists(env.DB,subscription.id,fixture.id,before))continue;
        try{
          await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({title:"NAVIXA · مباراة قريبة",body:`${fixture.home} × ${fixture.away} ${before?`بعد ${before} دقيقة`:"الآن"}`,tag:`navixa-match-${fixture.id}-${before}`,data:{url:"/",fixtureId:fixture.id}}),{TTL:120,urgency:"high",topic:`match-${fixture.id}-${before}`});
          await track(env.DB,subscription.id,fixture.id,before);
          delivered+=1;
        }catch(error){
          const status=error instanceof webpush.WebPushError?error.statusCode:0;
          if(status===404||status===410)await env.DB.prepare("DELETE FROM navixa_push_subscriptions WHERE id=?").bind(subscription.id).run();
        }
      }
    }
  }
  return {delivered,skipped:""};
}
