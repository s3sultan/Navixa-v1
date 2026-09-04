export const ALERT_POLICY_TYPES=["adhan","iqama","water","break","focus","name","wird","sadaqah","task"] as const;
export type AlertPolicyType=typeof ALERT_POLICY_TYPES[number];
export type AlertPolicy="user"|"on"|"off";
export type AlertPolicyChannels={screen:AlertPolicy;telegram:AlertPolicy};
export type AlertPolicyMap=Record<AlertPolicyType,AlertPolicyChannels>;

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
export type AlertPolicyDatabase={prepare:(sql:string)=>D1Statement};

export const defaultAlertPolicy=():AlertPolicyMap=>Object.fromEntries(ALERT_POLICY_TYPES.map(type=>[type,{screen:"user",telegram:"user"}])) as AlertPolicyMap;
export const isAlertPolicy=(value:unknown):value is AlertPolicy=>value==="user"||value==="on"||value==="off";

export async function ensureAlertPolicySchema(database:AlertPolicyDatabase){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_alert_policy (notification_type TEXT PRIMARY KEY, screen_policy TEXT NOT NULL DEFAULT 'user', telegram_policy TEXT NOT NULL DEFAULT 'user', updated_at TEXT NOT NULL)").run();
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

export async function writeAlertPolicy(database:AlertPolicyDatabase,policy:AlertPolicyMap){
  await ensureAlertPolicySchema(database);
  const now=new Date().toISOString();
  for(const type of ALERT_POLICY_TYPES){
    await database.prepare("INSERT INTO navixa_alert_policy(notification_type,screen_policy,telegram_policy,updated_at) VALUES(?,?,?,?) ON CONFLICT(notification_type) DO UPDATE SET screen_policy=excluded.screen_policy,telegram_policy=excluded.telegram_policy,updated_at=excluded.updated_at").bind(type,policy[type].screen,policy[type].telegram,now).run();
  }
}
