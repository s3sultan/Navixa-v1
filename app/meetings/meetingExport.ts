import { cleanTranscriptNoise } from "./meetingSummary";
import type { MeetingSession } from "./meetingStore";

export const NAVIXA_EXPORT_URL = "https://navixasa.com";
export const NAVIXA_EXPORT_FOOTER = "NAVIXA • navixasa.com • تم إنشاء هذا الملخص بواسطة NAVIXA";

export function meetingExportAllowed(session: MeetingSession) {
  const transcript = session.transcript?.trim() || "";
  if (!transcript) return { allowed: false, reason: "لا يوجد تفريغ موثوق لتصديره بعد." };
  const quality = cleanTranscriptNoise(transcript);
  if (quality.suspicious) return { allowed: false, reason: "تم إيقاف التصدير لأن جودة التفريغ غير كافية لإنتاج ملف موثوق." };
  if (!session.summary?.trim()) return { allowed: false, reason: "لا يوجد ملخص جاهز للتصدير بعد." };
  return { allowed: true, reason: "" };
}

export function buildBrandedMeetingMarkdown(session: MeetingSession) {
  const gate = meetingExportAllowed(session);
  if (!gate.allowed) throw new Error(gate.reason);
  const lines = [
    "# NAVIXA | استمع ولخّص",
    NAVIXA_EXPORT_URL,
    "",
    `# ${session.title}`,
    `التاريخ: ${new Date(session.createdAt).toLocaleString("ar-SA")}`,
    "",
    "## الملخص",
    session.summary.trim(),
    "",
    "## النقاط المهمة",
    ...(session.decisions.length ? session.decisions.map((value) => `- ${value}`) : ["- لا توجد نقاط مؤكدة إضافية."]),
    "",
    "## المهام والقرارات",
    ...(session.tasks.length ? session.tasks.map((value) => `- ${value}`) : ["- لا توجد مهام مؤكدة."]),
    "",
    NAVIXA_EXPORT_FOOTER,
  ];
  return lines.join("\n");
}
