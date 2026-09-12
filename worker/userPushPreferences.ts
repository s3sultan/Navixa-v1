export type PushPreferenceCategory="adhan"|"schedule";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
export type PushPreferenceDatabase={prepare:(sql:string)=>Statement};

export type UserPushPreference={
  category:PushPreferenceCategory;
  enabled:boolean;
  snoozedUntil:string;
};

export async function ensureUserPushPreferenceSchema(database:PushPreferenceDatabase){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_user_push_preferences (user_id TEXT NOT NULL,category TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,snoozed_until TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(user_id,category))").run();
}

export async function readUserPushPreference(database:PushPreferenceDatabase,userId:string,category:PushPreferenceCategory):Promise<UserPushPreference>{
  await ensureUserPushPreferenceSchema(database);
  const rows=await database.prepare("SELECT enabled,snoozed_until FROM navixa_user_push_preferences WHERE user_id=? AND category=? LIMIT 1").bind(userId,category).all<{enabled:number;snoozed_until:string}>();
  const row=rows.results[0];
  return {category,enabled:row?.enabled===1,snoozedUntil:row?.snoozed_until||""};
}

export async function isUserPushCategoryActive(database:PushPreferenceDatabase,userId:string,category:PushPreferenceCategory,now=Date.now()){
  const preference=await readUserPushPreference(database,userId,category);
  if(!preference.enabled)return false;
  if(!preference.snoozedUntil)return true;
  const snoozedUntil=Date.parse(preference.snoozedUntil);
  return !Number.isFinite(snoozedUntil)||snoozedUntil<=now;
}

export async function writeUserPushPreference(database:PushPreferenceDatabase,userId:string,category:PushPreferenceCategory,enabled:boolean,snoozedUntil:string){
  await ensureUserPushPreferenceSchema(database);
  const now=new Date().toISOString();
  await database.prepare("INSERT INTO navixa_user_push_preferences(user_id,category,enabled,snoozed_until,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,category) DO UPDATE SET enabled=excluded.enabled,snoozed_until=excluded.snoozed_until,updated_at=excluded.updated_at").bind(userId,category,enabled?1:0,snoozedUntil,now).run();
}
