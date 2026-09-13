export type EducationRuntimeMode = "test" | "live";

export type EducationRuntimePolicy = {
  mode: EducationRuntimeMode;
  allowProductionDelivery: boolean;
  allowSharedNavixaDatabase: boolean;
  requireVerifiedOfficialSources: boolean;
  requireExplicitTestRecipients: boolean;
};

export const DEFAULT_EDUCATION_RUNTIME_POLICY: Readonly<EducationRuntimePolicy> = Object.freeze({
  mode: "test",
  allowProductionDelivery: false,
  allowSharedNavixaDatabase: false,
  requireVerifiedOfficialSources: true,
  requireExplicitTestRecipients: true,
});

export function assertSafeEducationRuntimePolicy(policy: EducationRuntimePolicy) {
  if (policy.allowSharedNavixaDatabase) throw new Error("education_shared_navixa_database_forbidden");
  if (policy.mode === "live" && !policy.allowProductionDelivery) throw new Error("education_live_delivery_not_authorized");
  if (!policy.requireVerifiedOfficialSources) throw new Error("education_verified_sources_required");
  if (policy.mode === "test" && !policy.requireExplicitTestRecipients) throw new Error("education_test_allowlist_required");
  return true;
}
