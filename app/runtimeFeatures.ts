export const runtimeFeatureKeys = [
  "floating_assistant_enabled",
  "game_ad_enabled",
  "health_nudge_enabled",
  "member_platform_ribbon_enabled",
  "matches_home_enabled",
  "usage_analytics_enabled",
  "public_counter_enabled",
] as const;

export type RuntimeFeatureKey = (typeof runtimeFeatureKeys)[number];
export type RuntimeFeatureSettings = Record<RuntimeFeatureKey, "true" | "false">;
export type PublicRuntimeFeatures = {
  floatingAssistantEnabled: boolean;
  gameAdEnabled: boolean;
  healthNudgeEnabled: boolean;
  memberPlatformRibbonEnabled: boolean;
  matchesHomeEnabled: boolean;
  usageAnalyticsEnabled: boolean;
  publicCounterEnabled: boolean;
};

type RuntimeFeatureRow = { setting_key: string; setting_value: string };
type RuntimeFeatureStatement = { bind: (...values: unknown[]) => RuntimeFeatureStatement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
export type RuntimeFeatureDatabase = { prepare: (query: string) => RuntimeFeatureStatement };

export const runtimeFeatureDefaults: RuntimeFeatureSettings = {
  floating_assistant_enabled: "false",
  game_ad_enabled: "false",
  health_nudge_enabled: "false",
  member_platform_ribbon_enabled: "false",
  matches_home_enabled: "false",
  usage_analytics_enabled: "false",
  public_counter_enabled: "false",
};

export async function ensureRuntimeFeatureSchema(database: RuntimeFeatureDatabase) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_runtime_feature_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const now = new Date().toISOString();
  for (const key of runtimeFeatureKeys) {
    await database.prepare("INSERT OR IGNORE INTO navixa_runtime_feature_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key, runtimeFeatureDefaults[key], now).run();
  }
}

export async function readRuntimeFeatureSettings(database: RuntimeFeatureDatabase): Promise<RuntimeFeatureSettings> {
  const settings = { ...runtimeFeatureDefaults };
  try {
    const rows = await database.prepare("SELECT setting_key,setting_value FROM navixa_runtime_feature_settings").all<RuntimeFeatureRow>();
    for (const row of rows.results) {
      if (runtimeFeatureKeys.includes(row.setting_key as RuntimeFeatureKey) && (row.setting_value === "true" || row.setting_value === "false")) {
        settings[row.setting_key as RuntimeFeatureKey] = row.setting_value;
      }
    }
  } catch {
    // أي جدول لم يُرحّل بعد يبقى مغلقًا افتراضيًا بدل إظهار ميزة غير مقصودة.
  }
  return settings;
}

export function publicRuntimeFeatures(settings: RuntimeFeatureSettings): PublicRuntimeFeatures {
  return {
    floatingAssistantEnabled: settings.floating_assistant_enabled === "true",
    gameAdEnabled: settings.game_ad_enabled === "true",
    healthNudgeEnabled: settings.health_nudge_enabled === "true",
    memberPlatformRibbonEnabled: settings.member_platform_ribbon_enabled === "true",
    matchesHomeEnabled: settings.matches_home_enabled === "true",
    usageAnalyticsEnabled: settings.usage_analytics_enabled === "true",
    publicCounterEnabled: settings.public_counter_enabled === "true",
  };
}

export async function isRuntimeFeatureEnabled(database: RuntimeFeatureDatabase, key: RuntimeFeatureKey) {
  return (await readRuntimeFeatureSettings(database))[key] === "true";
}
