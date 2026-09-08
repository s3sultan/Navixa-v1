// NAVIXA private pilot access.
// Keep pilot-only features gated by the authenticated server session email.
export const NAVIXA_PILOT_EMAIL = "s2shug@gmail.com";

export function isNavixaPilotEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === NAVIXA_PILOT_EMAIL;
}
