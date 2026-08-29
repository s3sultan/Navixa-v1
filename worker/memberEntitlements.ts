import { isValidUserEmail, normalizeUserEmail, type D1Database } from "./userAuth.ts";
import { memberCooldownUntil, memberLockUntil, seatLimit, type NavixaMemberProject, type NavixaMemberRole } from "./subscriptionMembers.ts";

type MemberDatabase = D1Database;
export type MemberSeat = { id: string; email: string; role: NavixaMemberRole; project: string; seatNo: number; status: string; lockedUntil: string; cooldownUntil: string };

type AddMemberInput = { ownerUserId: string; ownerEmail: string; email: string; role: NavixaMemberRole; project?: NavixaMemberProject };

export async function listMemberSeats(database: MemberDatabase, ownerUserId: string): Promise<MemberSeat[]> {
  const rows = await database.prepare(
    "SELECT id,member_email AS email,role,project,seat_no AS seatNo,status,locked_until AS lockedUntil,cooldown_until AS cooldownUntil FROM navixa_subscription_members WHERE owner_user_id=? AND status IN ('active','cooldown') ORDER BY role,seat_no",
  ).bind(ownerUserId).all<MemberSeat>();
  return rows.results;
}

async function activeOwnerSubscription(database: MemberDatabase, ownerUserId: string, ownerEmail: string) {
  const rows = await database.prepare(
    "SELECT id FROM navixa_subscribers WHERE (user_id=? OR lower(contact)=lower(?)) AND status='active' AND subscription_ends_at>? ORDER BY updated_at DESC LIMIT 1",
  ).bind(ownerUserId, ownerEmail, new Date().toISOString()).all<{ id: string }>();
  return rows.results[0] || null;
}

export async function addMemberSeat(database: MemberDatabase, input: AddMemberInput) {
  const email = normalizeUserEmail(input.email);
  if (!isValidUserEmail(email)) throw new Error("invalid_email");
  if (email === normalizeUserEmail(input.ownerEmail)) throw new Error("owner_email");
  const ownerSubscription = await activeOwnerSubscription(database, input.ownerUserId, input.ownerEmail);
  if (!ownerSubscription) throw new Error("plus_required");

  const project = input.role === "full_member" ? "" : input.role === "kid" ? "kids" : input.project || "";
  if (input.role === "project_member" && !project) throw new Error("project_required");

  const direct = await database.prepare(
    "SELECT id FROM navixa_subscribers WHERE lower(contact)=lower(?) AND status='active' AND subscription_ends_at>? LIMIT 1",
  ).bind(email, new Date().toISOString()).all<{ id: string }>();
  if (direct.results[0]) throw new Error("email_has_plus");

  const occupied = await database.prepare(
    "SELECT id FROM navixa_subscription_members WHERE lower(member_email)=lower(?) AND status='active' LIMIT 1",
  ).bind(email).all<{ id: string }>();
  if (occupied.results[0]) throw new Error("email_in_use");

  const existing = await listMemberSeats(database, input.ownerUserId);
  const activeSameRole = existing.filter(seat => seat.role === input.role && seat.status === "active");
  const limit = seatLimit(input.role);
  if (activeSameRole.length >= limit) throw new Error("seat_limit");
  const coolingSameRole = existing.filter(seat => seat.role === input.role && seat.status === "cooldown" && Date.parse(seat.cooldownUntil) > Date.now());
  const usedSeatNos = new Set([...activeSameRole, ...coolingSameRole].map(seat => seat.seatNo));
  const seatNo = Array.from({ length: limit }, (_, index) => index + 1).find(value => !usedSeatNos.has(value));
  if (!seatNo) throw new Error("seat_cooldown");

  const user = await database.prepare("SELECT id FROM navixa_users WHERE lower(email)=lower(?) AND status<>'suspended' LIMIT 1").bind(email).all<{ id: string }>();
  const now = new Date().toISOString();
  const lockedUntil = memberLockUntil();
  const id = crypto.randomUUID();
  await database.prepare(
    "INSERT INTO navixa_subscription_members(id,owner_user_id,owner_subscriber_id,member_user_id,member_email,role,project,seat_no,status,locked_until,cooldown_until,created_at,updated_at,removed_at) VALUES(?,?,?,?,?,?,?,?,'active',?,'',?,?,'')",
  ).bind(id, input.ownerUserId, ownerSubscription.id, user.results[0]?.id || "", email, input.role, project, seatNo, lockedUntil, now, now).run();
  return { id, email, role: input.role, project, seatNo, status: "active", lockedUntil, cooldownUntil: "" };
}

export async function removeMemberSeat(database: MemberDatabase, ownerUserId: string, id: string) {
  const rows = await database.prepare(
    "SELECT id,locked_until FROM navixa_subscription_members WHERE id=? AND owner_user_id=? AND status='active' LIMIT 1",
  ).bind(id, ownerUserId).all<{ id: string; locked_until: string }>();
  const member = rows.results[0];
  if (!member) throw new Error("member_not_found");
  if (member.locked_until && Date.parse(member.locked_until) > Date.now()) throw new Error("member_locked");
  const now = new Date().toISOString();
  const cooldownUntil = memberCooldownUntil();
  await database.prepare(
    "UPDATE navixa_subscription_members SET status='cooldown',cooldown_until=?,removed_at=?,updated_at=? WHERE id=? AND owner_user_id=?",
  ).bind(cooldownUntil, now, now, id, ownerUserId).run();
  return { id, status: "cooldown", cooldownUntil };
}
