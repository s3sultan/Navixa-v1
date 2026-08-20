import { NextResponse } from "next/server.js";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type Row={setting_key:string;setting_value:string};
const keys=["feature_enabled","base_model_enabled","auto_language_enabled","max_file_mb","export_pdf_enabled","export_word_enabled","tutorial_enabled","usage_notice_enabled"] as const;
type Key=(typeof keys)[number];
type Settings=Record<Key,string>;
const defaults:Settings={feature_enabled:"true",base_model_enabled:"true",auto_language_enabled:"true",max_file_mb:"250",export_pdf_enabled:"true",export_word_enabled:"true",tutorial_enabled:"true",usage_notice_enabled:"true"};

async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function readSettings(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_feature_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_meeting_feature_settings").all<Row>();
  const values={...defaults};for(const row of rows.results)if(keys.includes(row.setting_key as Key))values[row.setting_key as Key]=row.setting_value;
  return values;
}
export async function GET(){
  const database=await db();const values=database?await readSettings(database):defaults;
  return NextResponse.json({enabled:values.feature_enabled==="true",baseModelEnabled:values.base_model_enabled==="true",autoLanguageEnabled:values.auto_language_enabled==="true",maxFileMb:Number(values.max_file_mb)||250,exportPdfEnabled:values.export_pdf_enabled==="true",exportWordEnabled:values.export_word_enabled==="true",tutorialEnabled:values.tutorial_enabled==="true",usageNoticeEnabled:values.usage_notice_enabled==="true"},{headers:{"Cache-Control":"public, max-age=60","Vary":"Accept-Encoding"}});
}
