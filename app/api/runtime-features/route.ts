import { NextResponse } from "next/server.js";
import { publicRuntimeFeatures, readRuntimeFeatureSettings, type RuntimeFeatureDatabase } from "../../runtimeFeatures.ts";

async function db(): Promise<RuntimeFeatureDatabase | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: RuntimeFeatureDatabase } }).env?.DB || null; }
  catch { return (globalThis as { DB?: RuntimeFeatureDatabase }).DB || null; }
}

export async function GET() {
  const database = await db();
  const settings = database ? await readRuntimeFeatureSettings(database) : undefined;
  return NextResponse.json({ features: publicRuntimeFeatures(settings || {
    floating_assistant_enabled: "false",
    game_ad_enabled: "false",
    health_nudge_enabled: "false",
    member_platform_ribbon_enabled: "false",
    matches_home_enabled: "false",
    usage_analytics_enabled: "false",
    public_counter_enabled: "false",
  }) }, { headers: { "Cache-Control": "no-store" } });
}
