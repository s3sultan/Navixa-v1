"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import "./floating-assistant.css";
import "./assistant-limit.css";

type Message = { id: string; from: "user" | "navixa"; text: string };
type MemoryKind = "name" | "preference" | "style" | "phrase";
type MemoryItem = { id: string; kind: MemoryKind; value: string; createdAt: string };
type AssistantStyle = "warm" | "calm" | "direct";

const MAX_MESSAGES = 24;
const CLEAR_LIMIT = 3;
const memoryKey = "navixa-assistant-memory-v1";
const today = () => new Date().toISOString().slice(0, 10);
const id = () => globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}-${Math.random()}`;
const normalise = (value: string) => value.replace(/[؟?!،,.]/g, " ").replace(/\s+/g, " ").trim();
const memoryTitle: Record<MemoryKind, string> = { name: "الاسم", preference: "تفضيل", style: "أسلوب الحديث", phrase: "عبارة مفيدة" };

const initialMessage = (): Message => ({ id: "hello", from: "navixa", text: "هلا، أنا NAVIXA. أقدر أساعدك بوضوح، وأتعلّم تفضيلاتك محليًا إذا فعّلت التعلّم." });

export default function FloatingAssistant({ onAddTask }: { onAddTask: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([initialMessage()]);
  const [position, setPosition] = useState({ x: 24, y: 0 });
  const [clears, setClears] = useState(0);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [assistantStyle, setAssistantStyle] = useState<AssistantStyle>("warm");
  const [showMemory, setShowMemory] = useState(false);
  const [typing, setTyping] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const name = useMemo(() => memory.find(item => item.kind === "name")?.value || "", [memory]);
  const preferences = useMemo(() => memory.filter(item => item.kind === "preference"), [memory]);

  useEffect(() => {
    document.documentElement.classList.toggle("assistant-off", localStorage.getItem("navixa-assistant-enabled") === "false");
    setPosition(current => ({ ...current, y: Math.max(90, innerHeight - 108) }));
    try {
      const savedChat = JSON.parse(localStorage.getItem("navixa-chat") || "[]");
      const savedMemory = JSON.parse(localStorage.getItem(memoryKey) || "[]");
      const savedClears = JSON.parse(localStorage.getItem("navixa-chat-clears") || "{}");
      if (Array.isArray(savedChat) && savedChat.length) setMessages(savedChat);
      if (Array.isArray(savedMemory)) setMemory(savedMemory.filter(item => item && typeof item.value === "string").slice(-40));
      setClears(savedClears.date === today() ? Number(savedClears.count) || 0 : 0);
      setLearningEnabled(localStorage.getItem("navixa-assistant-learning") !== "false");
      const savedStyle = localStorage.getItem("navixa-assistant-style");
      if (savedStyle === "warm" || savedStyle === "calm" || savedStyle === "direct") setAssistantStyle(savedStyle);
    } catch {}
  }, []);

  useEffect(() => localStorage.setItem("navixa-chat", JSON.stringify(messages.slice(-MAX_MESSAGES))), [messages]);
  useEffect(() => localStorage.setItem(memoryKey, JSON.stringify(memory.slice(-40))), [memory]);
  useEffect(() => localStorage.setItem("navixa-assistant-learning", String(learningEnabled)), [learningEnabled]);
  useEffect(() => localStorage.setItem("navixa-assistant-style", assistantStyle), [assistantStyle]);

  const append = (from: Message["from"], text: string) => setMessages(current => [...current, { id: id(), from, text }].slice(-MAX_MESSAGES));
  const reply = (text: string) => {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); append("navixa", text); }, 260);
  };
  const remember = (kind: MemoryKind, value: string) => {
    const clean = normalise(value).slice(0, 90);
    if (!clean || !learningEnabled) return false;
    setMemory(current => current.some(item => item.kind === kind && item.value.toLowerCase() === clean.toLowerCase()) ? current : [...current, { id: id(), kind, value: clean, createdAt: new Date().toISOString() }].slice(-40));
    return true;
  };
  const forget = (itemId: string) => setMemory(current => current.filter(item => item.id !== itemId));
  const stylePrefix = () => assistantStyle === "direct" ? "" : assistantStyle === "calm" ? "بهدوء، " : "أبشر، ";
  const saveRequest = (text: string) => {
    try {
      const key = "navixa-development-requests";
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      items.push({ text, createdAt: new Date().toISOString(), status: "جديد" });
      localStorage.setItem(key, JSON.stringify(items.slice(-100)));
    } catch {}
  };
  const learnFromUse = (text: string) => {
    const named = text.match(/(?:نادني|اسمي|انا اسمي)\s+([^،.!؟]{2,32}?)(?=\s+(?:و(?:أفضل|افضل|أحب|احب|أبي|ابغى|ودي)|لكن|وخل|وخلك)\b|[،.!؟]|$)/i)?.[1];
    if (named) remember("name", named);
    const preferred = text.match(/(?:احب|أفضل|افضل|ودي|ابغى|أبي)\s+([^،.!؟]{3,75})/i)?.[1];
    if (preferred) remember("preference", preferred);
    const chosenStyle = /(?:رسمي|مختصر|مباشر)/.test(text) ? "direct" : /(?:هادئ|بهدوء)/.test(text) ? "calm" : /(?:ودي|عفوي|بشري)/.test(text) ? "warm" : null;
    if (chosenStyle) { setAssistantStyle(chosenStyle); remember("style", chosenStyle === "direct" ? "مختصر ومباشر" : chosenStyle === "calm" ? "هادئ ومتزن" : "ودود وقريب" ); }
    const phrase = text.match(/(?:تعلم|احفظ|تذكّر|تذكر)\s+(?:أن|ان)?\s*(.{4,80})/i)?.[1];
    if (phrase) remember("phrase", phrase);
  };

  const understand = (raw: string) => {
    const text = normalise(raw);
    learnFromUse(text);
    const greetingName = name ? ` يا ${name}` : "";
    if (/^(هلا|هلو|السلام|سلام|مرحبا|صباح الخير|مساء الخير|كيف الحال|كيفك|شلونك|اخبارك)/i.test(text)) return reply(`${stylePrefix()}ياهلا${greetingName}، أنا حاضر. وش أهم شيء تبي نرتبه الآن؟`);
    if (/(شكرا|مشكور|يعطيك العافية|تسلم)/i.test(text)) return reply("العفو، هذا واجبي. إذا ودك نكمل خطوة بخطوة أنا معك.");
    if (/(وش تعرف عني|ماذا تعرف عني|وش حفظت|ذاكرتك)/i.test(text)) {
      if (!memory.length) return reply("ما حفظت عنك شيء إلى الآن. إذا فعّلت التعلّم، أحفظ فقط التفضيلات أو العبارات الواضحة التي تكتبها هنا، وعلى جهازك.");
      const summary = memory.map(item => `${memoryTitle[item.kind]}: ${item.value}`).join(" · ");
      return reply(`الذاكرة المحلية عندي: ${summary}. تقدر تحذف أو تعدّل أي معلومة من زر «ذاكرتي».`);
    }
    if (/(انس|امسح|احذف) (?:كل )?(?:الذاكرة|معلوماتي|تفضيلاتي)/i.test(text)) { setMemory([]); return reply("تم مسح الذاكرة المحلية للمساعد من هذا الجهاز."); }
    if (/(صحتي|الكاميرا|الجلوس|الماء|تمرين|وضعية)/i.test(text)) { reply(`${stylePrefix()}فتحت لك مركز صحتي؛ هناك أدوات الجلوس والتنفس والترطيب.`); window.setTimeout(() => { location.href = "/health"; }, 650); return; }
    if (/(تركيز|بومودورو|25 دقيقة)/i.test(text)) { reply(`${stylePrefix()}وصلتك إلى جلسة التركيز. اختر المدة وابدأ وقت ما يناسبك.`); location.hash = "focus"; return; }
    if (/(مراقبة الشاشة|شارك الشاشة|متابعة الشاشة|الاستماع|اسمع اسمي|راقب اسمي)/i.test(text)) { reply(`${stylePrefix()}فتحت لك أداة المتابعة. التشغيل لا يبدأ إلا بعد موافقتك.`); location.hash = "assistant"; return; }
    if (/(مباريات|دوري|نادي|فريق)/i.test(text)) { reply(`${stylePrefix()}جدول المباريات جاهز. افتح بطاقة المباريات واختر ناديك أو دوريك ثم فعّل التنبيه إذا رغبت.`); return; }
    if (/(مهمة|ذكرني|موعد|اجتماع|مقابلة|كويز|اختبار|فاينل|نهائي|تسليم|ددلاين|لازم|عندي)/i.test(text)) {
      const type = /اجتماع|مقابلة/.test(text) ? "موعد" : /كويز|اختبار|فاينل|نهائي/.test(text) ? "اختبار" : /تسليم|ددلاين/.test(text) ? "تسليم" : "مهمة";
      onAddTask(text);
      return reply(`${stylePrefix()}فهمتها كـ${type} وأضفتها للمهام. إذا عندك وقت أو تاريخ اكتب لي إياه وأرتبه معك.`);
    }
    if (/(أنشئ|انشئ|اصنع|ابني|سو لي|سوي لي|أضف ميزة|دعم)/i.test(text)) { saveRequest(text); return reply("فكرة جميلة. حفظتها ضمن اقتراحات تطوير NAVIXA المحلية حتى نراجعها ونبنيها معًا."); }
    if (/(تعبان|متضايق|زعلان|مضغوط|طفشت)/i.test(text)) return reply("واضح إن اليوم ثقيل. خذها خطوة خطوة: تبيني نرتب اللي مضايقك، نبدأ جلسة تنفس، أو نحول الشيء لمهمة صغيرة؟");
    const preferenceHint = preferences.length ? ` وأتذكر أنك ذكرت: ${preferences[preferences.length - 1].value}.` : "";
    reply(`${stylePrefix()}فهمت الفكرة${preferenceHint} عشان أساعدك بدقة: تبغاني أحولها لمهمة، أشرحها، أو نضبطها في NAVIXA؟`);
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("message") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    append("user", text);
    understand(text);
  };
  const clearChat = () => {
    if (clears >= CLEAR_LIMIT) return;
    const next = clears + 1;
    setClears(next);
    localStorage.setItem("navixa-chat-clears", JSON.stringify({ date: today(), count: next }));
    setMessages([{ id: id(), from: "navixa", text: "بدأنا من جديد. وش أول شيء تبي ننجزه؟" }]);
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => { drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: PointerEvent<HTMLButtonElement>) => { if (drag.current) setPosition({ x: Math.max(10, Math.min(innerWidth - 76, drag.current.left + event.clientX - drag.current.x)), y: Math.max(72, Math.min(innerHeight - 76, drag.current.top + event.clientY - drag.current.y)) }); };
  const long = messages.length >= MAX_MESSAGES;

  return <div className="floating-assistant" style={{ left: position.x, top: position.y }} dir="rtl">
    {open && <section className="assistant-panel" aria-label="مساعد NAVIXA">
      <header><div><img className="assistant-logo-mark" src="/navixa-mark.webp" alt="" /><span><b>NAVIXA</b><small>{learningEnabled ? "يتعلم محليًا بإذنك" : "ذاكرته المحلية متوقفة"}</small></span></div><div className="assistant-header-actions"><button className="assistant-memory-button" type="button" onClick={() => setShowMemory(value => !value)}>ذاكرتي</button><button type="button" aria-label="إغلاق المساعد" onClick={() => setOpen(false)}>×</button></div></header>
      {showMemory && <aside className="assistant-memory" aria-label="ذاكرة المساعد المحلية"><div><b>ذاكرتي المحلية</b><button type="button" onClick={() => setMemory([])}>مسح الكل</button></div><p>لا تغادر هذه المعلومات جهازك. راجعها أو احذف أي بند في أي وقت.</p><label className="assistant-learning-toggle"><input type="checkbox" checked={learningEnabled} onChange={event => setLearningEnabled(event.target.checked)} /> تعلّم التفضيلات والعبارات الواضحة</label><label className="assistant-style"><span>أسلوب الرد</span><select value={assistantStyle} onChange={event => setAssistantStyle(event.target.value as AssistantStyle)}><option value="warm">ودود وقريب</option><option value="calm">هادئ ومتزن</option><option value="direct">مختصر ومباشر</option></select></label><div className="assistant-memory-list">{memory.length ? memory.slice().reverse().map(item => <div key={item.id}><span><small>{memoryTitle[item.kind]}</small>{item.value}</span><button type="button" aria-label={`حذف ${item.value}`} onClick={() => forget(item.id)}>×</button></div>) : <small>لا توجد معلومات محفوظة بعد.</small>}</div></aside>}
      <div className="assistant-chat" aria-live="polite">{messages.slice(-MAX_MESSAGES).map(message => <p key={message.id} className={message.from}>{message.text}</p>)}{typing && <p className="navixa assistant-typing"><i></i><i></i><i></i></p>}{long && <aside className="chat-limit"><b>المحادثة صارت طويلة</b><span>ابدأ من الصفر لتبقى التجربة سريعة.</span><button disabled={clears >= CLEAR_LIMIT} onClick={clearChat}>{clears >= CLEAR_LIMIT ? "استخدمت حد الحذف اليومي" : `بدء محادثة جديدة (${CLEAR_LIMIT - clears})`}</button></aside>}</div>
      <div className="assistant-suggestions"><button type="button" onClick={() => understand("رتب يومي")}>رتب يومي</button><button type="button" onClick={() => understand("وش تعرف عني")}>وش تعرف عني؟</button><button type="button" onClick={() => understand("أبي أركز")}>أبي أركز</button></div>
      <form onSubmit={send}><input name="message" disabled={long} autoComplete="off" placeholder={long ? "ابدأ محادثة جديدة أولًا" : "اكتب بطريقتك الطبيعية..."} /><button disabled={long} aria-label="إرسال الرسالة">↑</button></form>
    </section>}
    <button className="assistant-bubble" aria-label="فتح مساعد NAVIXA" onClick={() => setOpen(value => !value)} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}><span className="mini-mark"><img src="/navixa-mark.webp" alt="" /></span><em>{learningEnabled ? "يتعلّم" : "متاح"}</em></button>
  </div>;
}
