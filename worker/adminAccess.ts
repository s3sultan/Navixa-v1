import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "./adminAuth.ts";

export const adminPermissionCatalog = [
  { key: "dashboard.read", label: "لوحة الإدارة", detail: "عرض المؤشرات والحالة التشغيلية ضمن جلسة الإدارة المحمية." },
  { key: "activity.read", label: "سجل النشاط", detail: "قراءة سجل الإجراءات الإدارية الموثق." },
  { key: "runtime.manage", label: "مفاتيح التشغيل", detail: "تعديل الميزات التشغيلية الثانوية بتحقق صريح من الخادم." },
  { key: "push.test", label: "اختبارات Push", detail: "تشغيل اختبارات الإشعارات الإدارية بتحقق صريح من الخادم." },
  { key: "billing.manage", label: "إدارة الدفع", detail: "تعديل إعدادات الدفع والخصومات والتواصل مع مزودي الدفع." },
  { key: "emergency.manage", label: "وضع الطوارئ", detail: "قراءة وتغيير حالة الاستمرارية والطوارئ وإرسال تنبيهاتها." },
  { key: "communications.test", label: "اختبارات التواصل", detail: "تشغيل اختبارات قنوات التواصل الخارجية مثل البريد الإداري." },
] as const;

export type AdminPermission = (typeof adminPermissionCatalog)[number]["key"];
export type AdminIdentity = {
  email: string;
  role: "admin";
  permissions: readonly AdminPermission[];
};

const allAdminPermissions = adminPermissionCatalog.map(item => item.key) as AdminPermission[];

export async function resolveAdminIdentity(request: Request): Promise<AdminIdentity | null> {
  if (request.method !== "GET" && request.method !== "HEAD" && !isTrustedSameOriginRequest(request)) return null;
  const secret = await resolveAdminJwtSecret();
  if (!secret) return null;
  const claims = await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret);
  if (!claims) return null;
  return { email: claims.email, role: "admin", permissions: allAdminPermissions };
}

export async function requireAdminPermission(request: Request, permission: AdminPermission) {
  const identity = await resolveAdminIdentity(request);
  return identity?.permissions.includes(permission) ? identity : null;
}
