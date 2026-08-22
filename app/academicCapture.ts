export type AcademicCaptureKind="quiz"|"midterm"|"presentation"|"deadline"|"appointment";

export type AcademicCapture={
  kind:AcademicCaptureKind;
  label:string;
  raw:string;
  dateLabel:string;
  timeLabel:string;
  confidence:"clear"|"needs_review";
};

const normalizeDigits=(value:string)=>value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
const kinds:{kind:AcademicCaptureKind;label:string;terms:RegExp}[]=[
  {kind:"quiz",label:"كويز",terms:/(كويز|quiz|اختبار قصير)/i},
  {kind:"midterm",label:"ميد",terms:/(ميد|ميدترم|منتصف الفصل|midterm)/i},
  {kind:"presentation",label:"عرض تقديمي",terms:/(برزنتيشن|presentation|عرض تقديمي|عرض المشروع)/i},
  {kind:"deadline",label:"موعد تسليم",terms:/(تسليم|ددلاين|deadline|آخر موعد)/i},
  {kind:"appointment",label:"موعد",terms:/(موعد|اجتماع|مقابلة)/i},
];

const datePattern=/(?:\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b|\b(?:اليوم|بكرة|غدًا|غدا|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\b)/i;
const timePattern=/(?:الساعة|عند)\s*\d{1,2}(?::\d{2})?\s*(?:صباحًا|صباحا|مساءً|مساء|am|pm)?/i;

export const captureAcademicDate=(spoken:string):AcademicCapture|null=>{
  const raw=spoken.trim().replace(/\s+/g," ");
  if(!raw)return null;
  const normalized=normalizeDigits(raw);
  const match=kinds.find(item=>item.terms.test(normalized));
  if(!match)return null;
  const date=datePattern.exec(normalized)?.[0]||"لم يُحدد التاريخ بوضوح";
  const time=timePattern.exec(normalized)?.[0]||"لم يُحدد الوقت";
  return {kind:match.kind,label:match.label,raw,dateLabel:date,timeLabel:time,confidence:date==="لم يُحدد التاريخ بوضوح"?"needs_review":"clear"};
};
