export type FeatureAccessSession = {
  enabled?: boolean;
  signedIn?: boolean;
  plus?: { status?: string } | null;
};

export function isFeatureAccessActive(session: FeatureAccessSession | null | undefined) {
  const status = session?.plus?.status;
  return session?.signedIn === true && (status === "trial" || status === "active");
}
