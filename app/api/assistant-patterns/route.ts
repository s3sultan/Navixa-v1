import { NextResponse } from "next/server.js";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_assistant_global_patterns (id TEXT PRIMARY KEY,trigger_text TEXT NOT NULL,response_text TEXT NOT NULL,source_contribution_id TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run()}

export async function GET(){const database=await db();if(!database)return NextResponse.json({patterns:[]},{headers:{"Cache-Control":"public, max-age=120, s-maxage=300, stale-while-revalidate=900"}});await schema(database);const rows=await database.prepare("SELECT id,trigger_text,response_text FROM navixa_assistant_global_patterns WHERE active=1 ORDER BY updated_at DESC LIMIT 40").all<{id:string;trigger_text:string;response_text:string}>();return NextResponse.json({patterns:rows.results.map(row=>({id:row.id,trigger:row.trigger_text,response:row.response_text}))},{headers:{"Cache-Control":"public, max-age=120, s-maxage=300, stale-while-revalidate=900"}})}
