export const ALERT_POLICY_TYPES=["adhan","iqama","water","break","focus","name","wird","sadaqah","task"] as const;
export type AlertPolicyType=typeof ALERT_POLICY_TYPES[number];
export type AlertPolicy="user"|"on"|"off";
export type AlertPolicyChannels={screen:AlertPolicy;telegram:AlertPolicy};
export type AlertPolicyMap=Record<AlertPolicyType,AlertPolicyChannels>;
export type AlertMessageMap=Partial<Record<AlertPolicyType,string>>;

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
export type AlertPolicyDatabase={prepare:(sql:string)=>D1Statement};

export const defaultAlertPolicy=():AlertPolicyMap=>Object.fromEntries(ALERT_POLICY_TYPES.map(type=>[type,{screen:"user",telegram:"user"}])) as AlertPolicyMap;
export const isAlertPolicy=(value:unknown):value is AlertPolicy=>value==="user"||value==="on"||value==="off";

export async function ensureAlertPolicySchema(database:AlertPolicyDatabase){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_alert_policy (notification_type TEXT PRIMARY KEY, screen_policy TEXT NOT NULL DEFAULT 'user', telegram_policy TEXT NOT NULL DEFAULT 'user', message TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)").run();
}

export async function readAlertPolicy(database:AlertPolicyDatabase):Promise<AlertPolicyMap>{
  await ensureAlertPolicySchema(database);
  const rows=await database.prepare("SELECT notification_type,screen_policy,telegram_policy FROM navixa_alert_policy").all<{notification_type:string;screen_policy:string;telegram_policy:string}>();
  const policy=defaultAlertPolicy();
  for(const row of rows.results){
    if(!ALERT_POLICY_TYPES.includes(row.notification_type as AlertPolicyType))continue;
    const type=row.notification_type as AlertPolicyType;
    policy[type]={screen:isAlertPolicy(row.screen_policy)?row.screen_policy:"user",telegram:isAlertPolicy(row.telegram_policy)?row.telegram_policy:"user"};
  }
  return policy;
}

export async function readAlertMessages(database:AlertPolicyDatabase):Promise<AlertMessageMap>{
  await ensureAlertPolicySchema(database);
  const rows=await database.prepare("SELECT notification_type,message FROM navixa_alert_policy").all<{notification_type:string;message:string}>();
  const messages:AlertMessageMap={};
  for(const row of rows.results){if(ALERT_POLICY_TYPES.includes(row.notification_type as AlertPolicyType)&&row.message.trim())messages[row.notification_type as AlertPolicyType]=row.message.trim().slice(0,240)}
  return messages;
}

export async function writeAlertPolicy(database:AlertPolicyDatabase,policy:AlertPolicyMap,messages:AlertMessageMap={}){
  await ensureAlertPolicySchema(database);
  const now=new Date().toISOString();
  for(const type of ALERT_POLICY_TYPES){
    const message=(messages[type]||"").trim().slice(0,240);
    await database.prepare("INSERT INTO navixa_alert_policy(notification_type,screen_policy,telegram_policy,message,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(notification_type) DO UPDATE SET screen_policy=excluded.screen_policy,telegram_policy=excluded.telegram_policy,message=excluded.message,updated_at=excluded.updated_at").bind(type,policy[type].screen,policy[type].telegram,message,now).run();
  }
}
