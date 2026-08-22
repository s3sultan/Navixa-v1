"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import "./floating-assistant.css";
import "./assistant-limit.css";
import { betaUsageLabel, betaUsageRemaining, consumeBetaUsage } from "./betaUsage";

type Message = { id: string; from: "user" | "navixa"; text: string; at: string };
type MemoryKind = "name" | "preference" | "style" | "phrase";
type MemoryItem = { id: string; kind: MemoryKind; value: string; createdAt: string };
type AssistantStyle = "warm" | "calm" | "direct";
type GlobalPattern = { id: string; trigger: string; response: string };
type AssistantIntent = "welcome" | "identity" | "capabilities" | "privacy" | "idea" | "emotion" | "task" | "tool" | "summary" | "academic" | "subscription" | "general";

const MAX_MESSAGES = 32;
const CLEAR_LIMIT = 3;
const memoryKey = "navixa-assistant-memory-v1";
const today = () => new Date().toISOString().slice(0, 10);
const id = () => globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}-${Math.random()}`;
const normalise = (value: string) => value.replace(/[؟?!،,.]/g, " ").replace(/\s+/g, " ").trim();
const memoryTitle: Record<MemoryKind, string> = { name: "الاسم", preference: "تفضيل", style: "أسلوب الحديث", phrase: "معلومة مفيدة" };
const makeMessage = (from: Message["from"], text: string): Message => ({ id: id(), from, text, at: new Date().toISOString() });
const initialMessage = () => makeMessage("navixa", "هلا، أنا NAVIXA. قل لي اللي في بالك بطريقتك؛ أساعدك نفهمه أو نرتبه، وما أحفظ شيئًا إلا بإذنك وعلى جهازك.");
const pickReply = (seed: string, choices: string[]) => choices[[...seed].reduce((total, letter) => total + letter.charCodeAt(0), 0) % choices.length] || choices[0] || "";
const shortEcho = (value: string) => normalise(value).slice(0, 72).replace(/[،.!؟]+$/g, "");

export default function FloatingAssistant({ onAddTask, openRequest }: { onAddTask: (title: string) => void; openRequest: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([initialMessage()]);
  const [position, setPosition] = useState({ x: 24, y: 0 });
  const [compactLauncher, setCompactLauncher] = useState(false);
  const [clears, setClears] = useState(0);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [assistantStyle, setAssistantStyle] = useState<AssistantStyle>("warm");
  const [showMemory, setShowMemory] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [globalLearning, setGlobalLearning] = useState(false);
  const [sensitiveShareConsent, setSensitiveShareConsent] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [globalPatterns, setGlobalPatterns] = useState<GlobalPattern[]>([]);
  const [lastIntent, setLastIntent] = useState<AssistantIntent>("welcome");
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const name = useMemo(() => memory.find(item => item.kind === "name")?.value || "", [memory]);
  const preferences = useMemo(() => memory.filter(item => item.kind === "preference"), [memory]);

  useEffect(() => {
    document.documentElement.classList.toggle("assistant-off", localStorage.getItem("navixa-assistant-enabled") === "false");
    const mobileQuery = window.matchMedia("(max-width: 650px)");
    const syncLauncherLayout = () => {
      const isCompact = window.innerWidth <= 650 || mobileQuery.matches;
      setCompactLauncher(isCompact);
      if (!isCompact) setPosition(current => ({ ...current, y: Math.max(90, window.innerHeight - 108) }));
    };
    syncLauncherLayout();
    // بعض متصفحات الجوال تثبت viewport بعد تهيئة React بلحظة؛ المزامنة الثانية تمنع موضعًا خارج الشاشة.
    const settleTimer = window.setTimeout(syncLauncherLayout, 180);
    mobileQuery.addEventListener("change", syncLauncherLayout);
    window.addEventListener("resize", syncLauncherLayout);
    try {
      const savedChat = JSON.parse(localStorage.getItem("navixa-chat") || "[]");
      const savedMemory = JSON.parse(localStorage.getItem(memoryKey) || "[]");
      const savedClears = JSON.parse(localStorage.getItem("navixa-chat-clears") || "{}");
      if (Array.isArray(savedChat) && savedChat.length) setMessages(savedChat.filter(item => item && typeof item.text === "string").slice(-MAX_MESSAGES).map(item => ({ ...item, at: item.at || new Date().toISOString() })));
      if (Array.isArray(savedMemory)) setMemory(savedMemory.filter(item => item && typeof item.value === "string").slice(-40));
      setClears(savedClears.date === today() ? Number(savedClears.count) || 0 : 0);
      setLearningEnabled(localStorage.getItem("navixa-assistant-learning") !== "false");
      const savedStyle = localStorage.getItem("navixa-assistant-style");
      if (savedStyle === "warm" || savedStyle === "calm" || savedStyle === "direct") setAssistantStyle(savedStyle);
      setGlobalLearning(localStorage.getItem("navixa-assistant-global-learning") === "true");
    } catch {}
    void fetch("/api/assistant-patterns").then(response => response.ok ? response.json() : { patterns: [] }).then((data: { patterns?: GlobalPattern[] }) => setGlobalPatterns(Array.isArray(data.patterns) ? data.patterns.slice(0, 40) : [])).catch(() => setGlobalPatterns([]));
    return () => {
      window.clearTimeout(settleTimer);
      mobileQuery.removeEventListener("change", syncLauncherLayout);
      window.removeEventListener("resize", syncLauncherLayout);
    };
  }, []);

  useEffect(() => {
    if (!openRequest) return;
    localStorage.removeItem("navixa-assistant-enabled");
    document.documentElement.classList.remove("assistant-off");
    setOpen(true);
  }, [openRequest]);

  useEffect(() => localStorage.setItem("navixa-chat", JSON.stringify(messages.slice(-MAX_MESSAGES))), [messages]);
  useEffect(() => localStorage.setItem(memoryKey, JSON.stringify(memory.slice(-40))), [memory]);
  useEffect(() => localStorage.setItem("navixa-assistant-learning", String(learningEnabled)), [learningEnabled]);
  useEffect(() => localStorage.setItem("navixa-assistant-style", assistantStyle), [assistantStyle]);
  useEffect(() => localStorage.setItem("navixa-assistant-global-learning", String(globalLearning)), [globalLearning]);
  useEffect(() => { if (open) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [messages, typing, open]);

  const append = (from: Message["from"], text: string) => setMessages(current => [...current, makeMessage(from, text)].slice(-MAX_MESSAGES));
  const reply = (text: string) => {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); append("navixa", text); }, 240);
  };
  const remember = (kind: MemoryKind, value: string) => {
    const clean = normalise(value).slice(0, 90);
    if (!clean || !learningEnabled) return false;
    setMemory(current => current.some(item => item.kind === kind && item.value.toLowerCase() === clean.toLowerCase()) ? current : [...current, { id: id(), kind, value: clean, createdAt: new Date().toISOString() }].slice(-40));
    return true;
  };
  const forget = (itemId: string) => setMemory(current => current.filter(item => item.id !== itemId));
  const stylePrefix = () => assistantStyle === "direct" ? "" : assistantStyle === "calm" ? "بهدوء، " : "";
  const respond = (intent: AssistantIntent, text: string) => { setLastIntent(intent); reply(text); };
  const friendlyName = name ? ` يا ${name}` : "";
  const rememberFromMessage = (text: string) => {
    const named = text.match(/(?:نادني|اسمي|انا اسمي)\s+([^،.!؟]{2,32}?)(?=\s+(?:و(?:تحدث|كلمني|رد|جاوب|خل|خلك|أفضل|افضل|أحب|احب|أبي|ابغى|ودي)|لكن)(?:\s|$)|[،.!؟]|$)/i)?.[1];
    if (named) remember("name", named);
    const preferred = text.match(/(?:أفضل|افضل|أحب|احب|ودي|ابغى|أبي|ابغا)\s+((?:(?:ردود|أسلوب|طريقة|أن تكون|إنك تكون|تكلمني|تتحدث معي)[^،.!؟]{0,70}))/i)?.[1];
    if (preferred) remember("preference", preferred);
    const chosenStyle = /(?:رسمي|مختصر|مباشر)/.test(text) ? "direct" : /(?:هادئ|بهدوء)/.test(text) ? "calm" : /(?:ودي|عفوي|بشري)/.test(text) ? "warm" : null;
    if (chosenStyle) {
      setAssistantStyle(chosenStyle);
      remember("style", chosenStyle === "direct" ? "مختصر ومباشر" : chosenStyle === "calm" ? "هادئ ومتزن" : "ودود وقريب");
    }
    const explicitMemory = text.match(/(?:احفظ|تذكر|تذكّر|تعلم)\s+(?:أن|ان)?\s*(.{4,80})/i)?.[1];
    if (explicitMemory) return remember("phrase", explicitMemory);
    return Boolean(named || preferred || chosenStyle);
  };

  const shareLatestExchange = async () => {
    if (!betaUsageRemaining("assistantContribution")) { setShareStatus("اكتمل حد المساهمات الاختيارية التجريبي لليوم. محادثتك وذاكرتك المحلية مستمرتان بلا حد."); return; }
    const userIndex = messages.map(message => message.from).lastIndexOf("user");
    const question = userIndex >= 0 ? messages[userIndex]?.text || "" : "";
    const response = userIndex >= 0 ? messages.slice(userIndex + 1).find(message => message.from === "navixa")?.text || "" : "";
    if (!question || !response) { setShareStatus("أرسل رسالة وانتظر الرد أولًا، ثم اختر مشاركتها."); return; }
    setShareStatus("جارٍ إرسال مساهمة اختيارية للمراجعة…");
    const result = await fetch("/api/assistant-learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, response, sensitiveConsent: sensitiveShareConsent }) });
    const data = await result.json().catch(() => ({})) as { message?: string; error?: string };
    if (!result.ok) { setShareStatus(data.error || "تعذرت المشاركة."); return; }
    const usage = consumeBetaUsage("assistantContribution");
    setShareStatus(`${data.message || "تمت المشاركة للمراجعة."} متبقي ${usage.remaining} من ${usage.limit} اليوم.`);
  };

  const understand = (raw: string) => {
    const text = normalise(raw);
    const learned = rememberFromMessage(text);
    const preferenceHint = preferences.length ? ` وأتذكر أن أسلوبك المفضل: ${preferences[preferences.length - 1].value}.` : "";

    if (pendingTask) {
      if (/^(?:اي|ايوه|نعم|تمام|سجلها|أضفها|اضفها)$/i.test(text)) { onAddTask(pendingTask); setPendingTask(null); return respond("task", `${stylePrefix()}تم حفظها كمهمة. إذا تبي، أعطني وقتها وأرتبه لك.`); }
      if (/^(?:لا|مو الآن|مو الان|الغها|إلغاء)$/i.test(text)) { setPendingTask(null); return respond("general", "تمام، نخليها حديثًا بيننا فقط."); }
    }
    if (/^(?:من انت|مين انت|من تكون|عرفني بنفسك|وش انت)\??$/i.test(text)) return respond("identity", `أنا NAVIXA${friendlyName}. أساعدك تفهم الفكرة، ترتب الأولويات، وتستخدم أدواتك بدون تعقيد.\n\nخذ راحتك في الكلام؛ ما أحوّل أي شيء لمهمة أو تذكير إلا إذا طلبت مني ذلك.`);
    if (/(?:وش تقدر تسوي|وش تسوي|قدراتك|ساعدني في ايش)/i.test(text)) return respond("capabilities", "أساعدك في الشيء الذي أمامك الآن: نرتب فكرة، نحوّل أمرًا واضحًا إلى مهمة بعد موافقتك، نلخّص اجتماعًا أو محاضرة، أو نفتح أدوات التركيز والصحة والاستماع ومتابعة الشاشة. قل لي موقفك الحالي، وليس اسم الميزة فقط، وأنا أقترح أقصر طريق.");
    if (/^(هلا|هلو|السلام|سلام|مرحبا|صباح الخير|مساء الخير|كيف الحال|كيفك|شلونك|اخبارك)/i.test(text)) return respond("welcome", `${stylePrefix()}${pickReply(text,[`ياهلا${friendlyName}. وش أكثر شيء تبغى ترتبه اليوم؟`,`حياك${friendlyName}. نبدأ بفكرة، مهمة، أو شيء شاغل بالك؟`,`هلا بك${friendlyName}. قل لي الموضوع كما هو، وأنا أمسكه معك خطوة خطوة.`])}`);
    if (/(شكرا|مشكور|يعطيك العافية|تسلم)/i.test(text)) return respond("general", pickReply(text,["العفو، يسعدني. إذا احتجت نكمل من نفس النقطة أنا موجود.","الله يعافيك. خذ راحتك، ونكمل عندما تكون مستعدًا.","العفو. تبغاني أتركها كما هي، أو نأخذ الخطوة التالية؟"]));
    if (/(كيف تتعلم|كيف تحفظ|وش تحفظ|الخصوصية|بياناتي)/i.test(text)) return respond("privacy", "ذاكرتي المحلية تحفظ فقط الاسم أو التفضيل أو العبارة التي توافق عليها، وتبقى على جهازك. تقدر تراجعها أو تمسحها في أي وقت، ولا أشارك محادثتك تلقائيًا.");
    if (/(وش تعرف عني|ماذا تعرف عني|وش حفظت|ذاكرتك)/i.test(text)) { if (!memory.length) return respond("privacy", "ما حفظت عنك شيئًا حتى الآن. إذا رغبت، قل لي أسلوب الرد الذي تحبه أو اطلب مني حفظ معلومة محددة."); const summary = memory.map(item => `${memoryTitle[item.kind]}: ${item.value}`).join(" · "); return respond("privacy", `المحفوظ محليًا: ${summary}. وتقدر تعدله أو تمسحه من زر الذاكرة.`); }
    if (/(انس|امسح|احذف) (?:كل )?(?:الذاكرة|معلوماتي|تفضيلاتي)/i.test(text)) { setMemory([]); return respond("privacy", "تم مسح الذاكرة المحلية من هذا الجهاز."); }
    if (/(تعبان|متضايق|زعلان|مضغوط|طفشت)/i.test(text)) return respond("emotion", `${stylePrefix()}واضح إن اليوم ثقيل عليك. ما نحتاج نحل كل شيء الآن؛ تقدر تكتب اللي مضايقك كما هو، أو نقسمه إلى خطوة صغيرة واحدة تخفف الضغط.`);
    if (/(عندي فكرة|فكرة|وش رايك|ما رأيك|رايك)/i.test(text)) return respond("idea", `${stylePrefix()}أعطني الفكرة كما هي، حتى لو كانت ناقصة. سأبدأ برأيي الصريح: ما الذي فيها قوي، وما الذي قد يربك المستخدم، ثم نقترح نسخة أبسط إذا احتجنا.`);
    if (/(?:افتح|خذني|ودني|روح).*?(صحتي|الكاميرا|الجلوس|الماء|تمرين|وضعية)/i.test(text)) { respond("tool", `${stylePrefix()}بفتح لك مركز صحتي. التشغيل يبقى بيدك.`); window.setTimeout(() => { location.href = "/health"; }, 450); return; }
    if (/(?:افتح|خذني|ودني|روح).*?(تركيز|بومودورو)/i.test(text)) { respond("tool", `${stylePrefix()}نروح لجلسة التركيز.`); location.hash = "focus"; return; }
    if (/(?:افتح|خذني|ودني|روح).*?(مراقبة الشاشة|شارك الشاشة|متابعة الشاشة|الاستماع|اسمع اسمي)/i.test(text)) { respond("tool", `${stylePrefix()}أفتح لك الأداة، وما يبدأ الميكروفون أو مشاركة الشاشة إلا بعد موافقتك.`); location.hash = "assistant"; return; }
    if (/(?:لخص|تلخيص|فرغ|تفريغ).{0,30}(?:اجتماع|محاضرة|مكالمة|تسجيل|الصوت)/i.test(text) || /(?:اجتماع|محاضرة).{0,20}(?:طويل|كامل)/i.test(text)) { respond("summary", `${stylePrefix()}نفتح لك «لخّص اجتماعك». تقدر تقسّم التسجيل إلى أجزاء، وتراجع التفريغ والملخص قبل التصدير.`); window.setTimeout(() => { location.href = "/meetings"; }, 450); return; }
    if (/(?:كويز|quiz|ميد|mid|اختبار|تسليم|ديدلاين|deadline).{0,50}(?:موعد|بتاريخ|يوم|الأسبوع|بكرة|غدًا|غدا)?/i.test(text)) { setPendingTask(text); return respond("academic", `${stylePrefix()}التقطت أنها معلومة أكاديمية. أحفظها كتذكير مؤقتًا بعد تأكيدك، ويمكنك تعديل التاريخ والتنبيه قبل الحفظ.`); }
    if (/(?:اشتراك|بلس|plus|تجربة|إحالة|احالة|دعوة|مكافأة|مكافاه)/i.test(text)) return respond("subscription", "تقدر تكمل تجربة Plus براحتك، أو تشترك مباشرة في أي يوم منها عندما تكون جاهزًا. قبل الدفع يظهر لك السعر والتفاصيل بوضوح. أما الإحالة فمكافأتها تُثبت فقط بعد اشتراك موثّق، حتى يبقى النظام عادلًا للجميع.");
    if (/(?:افتح|ورني|أبي).*?(مباريات|دوري|نادي|فريق)/i.test(text)) return respond("tool", `${stylePrefix()}بطاقة المباريات موجودة في الصفحة. اختر ناديك أو دوريك، وفعل التنبيه إذا رغبت.`);
    if (/(?:أضف|اضف|سجل|حط|حوّل).{0,25}(?:كمهمة|مهمة|كتذكير|تذكير|في المهام|بقائمة المهام)/i.test(text)) { onAddTask(text); return respond("task", `${stylePrefix()}تمت الإضافة. إذا عندك وقت أو تاريخ، اكتبه لي.`); }
    if (/(?:ذكرني|تذكير)/i.test(text)) return respond("task", `${stylePrefix()}أذكرك به. ما الشيء المطلوب، ومتى يناسبك؟`);
    if (/(?:عندي|لازم|موعد|اجتماع|مقابلة|اختبار|تسليم|ددلاين)/i.test(text)) { setPendingTask(text); return respond("task", `${stylePrefix()}فهمت. تبغاه يبقى حديثًا، أو أحفظه كمهمة؟ اكتب «نعم» فقط إذا تبي أحفظه.`); }
    const globalPattern = globalPatterns.find(pattern => { const trigger = normalise(pattern.trigger); return trigger.length >= 3 && text.includes(trigger); });
    if (globalPattern) return respond("general", globalPattern.response);
    if (learned) return respond("privacy", `${stylePrefix()}وصلتني، وحفظت تفضيلك محليًا ليكون أسلوبي أقرب لك. تقدر تغيره أو تمسحه متى شئت.`);
    const context = lastIntent === "idea" ? "إذا كانت تحتاج قرارًا، قل لي هدفها والشيء الذي يقلقك فيها." : lastIntent === "emotion" ? "خذ راحتك؛ اكتب اللي مضايقك كما هو، بلا ترتيب." : "أعطني مثالًا واحدًا أو النتيجة التي تبغاها، وأرد عليك بشكل عملي.";
    const echo = shortEcho(raw);
    return respond("general", `${stylePrefix()}فهمت${echo ? ` أنك تقصد: «${echo}»` : "عليك"}.${preferenceHint} ${context}`);
  };

  const toggleAssistant = () => {
    // يضمن أن المستخدم يستطيع دائمًا إعادة تشغيل المساعد من الزر العائم على جهازه.
    localStorage.removeItem("navixa-assistant-enabled");
    document.documentElement.classList.remove("assistant-off");
    setOpen(value => !value);
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("message") as HTMLTextAreaElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    append("user", text);
    understand(text);
  };
  const sendQuickMessage = (text: string) => { append("user", text); understand(text); };
  const clearChat = () => {
    if (clears >= CLEAR_LIMIT) return;
    const next = clears + 1;
    setClears(next);
    localStorage.setItem("navixa-chat-clears", JSON.stringify({ date: today(), count: next }));
    setPendingTask(null);
    setLastIntent("welcome");
    setMessages([makeMessage("navixa", "بدأنا من جديد. خذ راحتك، وش حاب تقول؟")]);
  };
  // السحب ميزة للماوس فقط؛ التقاط اللمس على الجوال كان قد يمنع حدث click في بعض المتصفحات.
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse" || !drag.current) return;
    setPosition({ x: Math.max(10, Math.min(innerWidth - 76, drag.current.left + event.clientX - drag.current.x)), y: Math.max(72, Math.min(innerHeight - 76, drag.current.top + event.clientY - drag.current.y)) });
  };
  const long = messages.length >= MAX_MESSAGES;
  const lastAssistantMessageId = useMemo(() => [...messages].reverse().find(message => message.from === "navixa")?.id || "", [messages]);
  const quickFollowUps = useMemo(() => {
    const choices:Record<AssistantIntent,string[]> = {
      welcome:["وش تقدر تسوي؟","أحتاج رأيك في فكرة","رتب أفكاري"],
      identity:["وش تقدر تسوي؟","كيف تحمي خصوصيتي؟","رتب لي فكرة"],
      capabilities:["أحتاج رأيك في فكرة","أبي تذكير","افتح أداة"],
      privacy:["وش تحفظ عني؟","امسح الذاكرة","غيّر أسلوب الرد"],
      idea:["أعطيك الفكرة","اختصرها لي","رتبها معي"],
      emotion:["أبي أتكلم فقط","أعطني خطوة صغيرة","خلنا نرتبها بهدوء"],
      task:["خليها حديث فقط","أبغى أحفظها","وش الخيارات؟"],
      tool:["افتح التركيز","أبي مباريات اليوم","كيف تعمل الخصوصية؟"],
      summary:["افتح تلخيص الاجتماعات","كيف أقسم تسجيلًا طويلًا؟","صدّر الملخص"],
      academic:["احفظ الموعد كتذكير","عدّل التنبيه","لا تحفظها الآن"],
      subscription:["كيف تبدأ التجربة؟","كيف تعمل الإحالة؟","افتح صفحة Plus"],
      general:["اختصر لي","أعطني مثال","خلنا نكمل"],
    };
    return choices[lastIntent];
  }, [lastIntent]);

  const launcherStyle = compactLauncher ? { left: 12, top: 96 } : { left: position.x, top: position.y };

  return <div className="floating-assistant" style={launcherStyle} dir="rtl">
    {open && <section className="assistant-panel" aria-label="محادثة NAVIXA">
      <header><div><img className="assistant-logo-mark" src="/navixa-mark.webp" alt="" /><span><b>NAVIXA</b><small><i className="assistant-online-dot"/>{learningEnabled ? "محادثة خاصة على جهازك" : "الذاكرة المحلية متوقفة"}</small></span></div><div className="assistant-header-actions"><button className="assistant-memory-button" type="button" aria-label="فتح الذاكرة" onClick={() => setShowMemory(value => !value)}>⌁</button><button type="button" aria-label="إغلاق المساعد" onClick={() => setOpen(false)}>×</button></div></header>
      {showMemory && <aside className="assistant-memory" aria-label="ذاكرة المساعد المحلية"><div><b>ذاكرتي المحلية</b><button type="button" onClick={() => setMemory([])}>مسح الكل</button></div><p>لا تُحفظ إلا التفضيلات أو العبارات التي توافق عليها، وتبقى على هذا الجهاز.</p><label className="assistant-learning-toggle"><input type="checkbox" checked={learningEnabled} onChange={event => setLearningEnabled(event.target.checked)} /> تعلّم محلي بإذني</label><label className="assistant-learning-toggle"><input type="checkbox" checked={globalLearning} onChange={event => { setGlobalLearning(event.target.checked); setShareStatus(""); }} /> أساهم اختياريًا في تحسين الردود العامة</label>{globalLearning&&<div className="assistant-global-learning"><p>لا نشارك شيئًا تلقائيًا. أنت تختار آخر سؤال ورد لإرساله للمراجعة قبل اعتماده للجميع.</p><small className="assistant-beta-note">نسخة تجريبية: {betaUsageLabel("assistantContribution")} للمساهمات العالمية الاختيارية. المحادثة والذاكرة المحلية بلا حدود.</small><label><input type="checkbox" checked={sensitiveShareConsent} onChange={event => setSensitiveShareConsent(event.target.checked)} /> أوافق بشكل مستقل إذا احتوت المساهمة معلومات شخصية</label><button type="button" onClick={() => void shareLatestExchange()}>مشاركة آخر سؤال ورد للمراجعة</button>{shareStatus&&<small>{shareStatus}</small>}</div>}<label className="assistant-style"><span>أسلوب الرد</span><select value={assistantStyle} onChange={event => setAssistantStyle(event.target.value as AssistantStyle)}><option value="warm">ودود وقريب</option><option value="calm">هادئ ومتزن</option><option value="direct">مختصر ومباشر</option></select></label><div className="assistant-memory-list">{memory.length ? memory.slice().reverse().map(item => <div key={item.id}><span><small>{memoryTitle[item.kind]}</small>{item.value}</span><button type="button" aria-label={`حذف ${item.value}`} onClick={() => forget(item.id)}>×</button></div>) : <small>لا توجد معلومات محفوظة بعد.</small>}</div></aside>}
      <div className="assistant-chat" ref={chatRef} aria-live="polite">{messages.length<=1&&<div className="assistant-quick-replies"><small>ابدأ من هنا أو اكتب بطريقتك</small><div><button type="button" onClick={()=>sendQuickMessage("وش تقدر تسوي؟")}>وش تقدر تسوي؟</button><button type="button" onClick={()=>sendQuickMessage("أحتاج رأيك في فكرة")}>أحتاج رأيك</button><button type="button" onClick={()=>sendQuickMessage("رتب أفكاري بدون مهام")}>رتب أفكاري</button></div></div>}{messages.slice(-MAX_MESSAGES).map(message => <div className={`assistant-message-group ${message.from}`} key={message.id}><article className={`assistant-message ${message.from}`}><p>{message.text}</p><time dateTime={message.at}>{new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(message.at))}{message.from === "user" && <span>✓✓</span>}</time></article>{message.id===lastAssistantMessageId&&!typing&&<div className="assistant-follow-ups" aria-label="متابعات مقترحة">{quickFollowUps.map(prompt=><button type="button" key={prompt} onClick={()=>sendQuickMessage(prompt)}>{prompt}</button>)}</div>}</div>)}{typing && <article className="assistant-message navixa assistant-typing"><i></i><i></i><i></i></article>}{long && <aside className="chat-limit"><b>نقفل هذه المحادثة ونبدأ من جديد؟</b><span>المحادثة الطويلة تبقى على جهازك فقط.</span><button disabled={clears >= CLEAR_LIMIT} onClick={clearChat}>{clears >= CLEAR_LIMIT ? "استخدمت حد الحذف اليومي" : "بدء محادثة جديدة"}</button></aside>}</div>
      <form onSubmit={send}><textarea name="message" rows={1} disabled={long} autoComplete="off" placeholder={long ? "ابدأ محادثة جديدة أولًا" : "اكتب اللي في بالك..."} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit()}}}/><button disabled={long} aria-label="إرسال الرسالة">➤</button></form>
    </section>}
    <button className="assistant-bubble" type="button" aria-label="فتح مساعد NAVIXA" aria-expanded={open} onClick={toggleAssistant} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><span className="mini-mark"><img src="/navixa-mark.webp" alt="" /></span><span className="assistant-bubble-copy"><b>المساعد</b><em>{learningEnabled ? "افتح المحادثة" : "جاهز للمساعدة"}</em></span></button>
  </div>;
}
