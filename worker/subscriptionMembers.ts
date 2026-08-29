export const NAVIXA_MEMBER_POLICY = {
  fullMembers: 1,
  paidProjectMembers: 1,
  kidsMembers: 2,
  lockDays: 21,
  cooldownDays: 7,
} as const;

export type NavixaMemberRole = "full_member" | "project_member" | "kid";
export type NavixaMemberProject = "fitness" | "learning" | "kids";

export function normalizeMemberEmail(value: string) {
  return value.trim().toLowerCase();
}

export function memberCanAccessProject(role: NavixaMemberRole, memberProject: string, requestedProject: NavixaMemberProject) {
  if (role === "full_member") return true;
  if (role === "kid") return requestedProject === "kids";
  return memberProject === requestedProject;
}

export function seatLimit(role: NavixaMemberRole) {
  if (role === "full_member") return NAVIXA_MEMBER_POLICY.fullMembers;
  if (role === "project_member") return NAVIXA_MEMBER_POLICY.paidProjectMembers;
  return NAVIXA_MEMBER_POLICY.kidsMembers;
}

export function futureIso(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function memberLockUntil(from = new Date()) {
  return futureIso(NAVIXA_MEMBER_POLICY.lockDays, from);
}

export function memberCooldownUntil(from = new Date()) {
  return futureIso(NAVIXA_MEMBER_POLICY.cooldownDays, from);
}
