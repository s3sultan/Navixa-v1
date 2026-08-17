"use client";
import Link from "next/link";
import {useState} from "react";
import "./admin.css";
import AdminHealthSettings from "./settings/AdminHealthSettings";
import AdminCounterSettings from "./settings/AdminCounterSettings";
import AdminAssistantSettings from "./settings/AdminAssistantSettings";
import AdminAlertSettings from "./settings/AdminAlertSettings";
import { useAdminAuth } from "./useAdminAuth";

const features=[
  ["متابعة الأسماء والكلمات","الاستماع والتنبيه وإضافة المهام","◉","1,284"],
  ["مراقبة الشاشة","مشاركة محلية بموافقة المستخدم","▣","938"],
  ["الصحة ووضعية الجلوس","الحركة والماء والتمارين الخفيفة","♡","1,106"],
  ["المواعيد والمهام","تذكيرات وتقويم وأتمتة","▦","2,106"],
  ["جلسات التركيز","مؤقت وتحليل الإنتاجية","◎","1,750"],
  ["الملاحظات والتلخيص","حفظ وتصدير الملخصات","▤","1,492"],
];
const permissions=[
  ["المستخدمون والأدوار","إضافة وتعديل وإيقاف وتعيين الأدوار"],["الميزات والخدمات","تفعيل وتعطيل وضبط كل ميزة"],["المحتوى والتمارين","إنشاء وتعديل ونشر وحذف المحتوى"],["التنبيهات والتقويم","إدارة القوالب والجداول والتكاملات"],["الخصوصية والبيانات","الموافقات والتصدير والحذف وسياسات الاحتفاظ"],["الإعلانات والتواصل","الحملات والمساحات والروابط والموافقات"],["الطوارئ","إيقاف أو تفعيل أي خدمة فورًا"],["السجلات والتقارير","عرض وتصفية وتصدير سجل النشاط"],
];

export default function AdminPage(){
  const { allowed, checking } = useAdminAuth();
  const [enabled,setEnabled]=useState(features.map(()=>true));const [active,setActive]=useState("نظرة عامة");const [toast,setToast]=useState("");
  const tell=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),2200)};
  const toggle=(i:number)=>{const n=[...enabled];n[i]=!n[i];setEnabled(n);tell(`${features[i][0]}: ${n[i]?"مفعّلة":"متوقفة"}`)};
  const go=(name:string,id:string)=>{setActive(name);document.getElementById(id)?.scrollIntoView({behavior:"smooth"})};
  if (checking || !allowed) return null;
  return <main dir="rtl" className="admin-shell">{toast&&<div className="toast">✓ {toast}</div>}
    <aside className="admin-side"><div className="logo"><span className="admin-logo-mark"><img src="/navixa-mark.png" alt="" /></span><div><b>NAVIXA</b><small>ADMIN CENTER</small></div></div><div className="admin-badge">صلاحيات المدير الكاملة</div><nav>
      {[["نظرة عامة","overview","⌂"],["المميزات","features","✦"],["المستخدمون","users","♙"],["الصلاحيات","permissions","⌘"],["المحتوى","content","▤"],["التكاملات","integrations","⌁"],["الإعدادات","settings","⚙"],["السجل","activity","▤"]].map(x=><button key={x[0]} className={active===x[0]?"on":""} onClick={()=>go(x[0],x[1])}><i>{x[2]}</i>{x[0]}</button>)}
      <button onClick={()=>location.href="/admin/ads"}><i>▣</i>الإعلانات</button><button onClick={()=>location.href="/admin/emergency"}><i>⚠</i>الطوارئ</button><button onClick={()=>location.href="/admin/social"}><i>◎</i>التواصل</button></nav><div className="admin-side-bottom"><Link href="/">← العودة إلى NAVIXA</Link><div><span>س</span><p><b>سلطان</b><small>المدير الأعلى</small></p></div></div></aside>
    <section className="admin-page"><header className="admin-header" id="overview"><div><small>مركز التحكم الكامل</small><h1>لوحة إدارة NAVIXA</h1><p>كل المستخدمين والميزات والمحتوى والصلاحيات من مكان واحد.</p></div><div><button onClick={()=>tell("لا توجد أعطال حرجة")}>♢<i/></button><Link href="/">عرض التطبيق ↗</Link></div></header>
      <section className="health-banner"><div><span className="health-icon">✓</span><div><small>حالة المنصة</small><h2>جميع خدمات NAVIXA تعمل طبيعيًا</h2><p>الاستماع · الشاشة · الصحة · المهام · التنبيهات</p></div></div><div className="service-pills"><span><i/> الخصوصية</span><span><i/> الذكاء</span><span><i/> التنبيهات</span><span><i/> التقويم</span></div></section>
      <section className="admin-metrics"><article id="users"><span className="am-icon purple">♙</span><div><small>المستخدمون</small><b>12,840</b><em>1,284 نشط اليوم</em></div></article><article><span className="am-icon green">✓</span><div><small>الموافقات النشطة</small><b>9,316</b><em>قابلة للسحب دائمًا</em></div></article><article><span className="am-icon blue">✦</span><div><small>العمليات اليوم</small><b>18,429</b><em>96% ناجحة</em></div></article><article><span className="am-icon orange">♢</span><div><small>التنبيهات</small><b>4,815</b><em>تم التسليم</em></div></article></section>
      <div className="admin-grid" id="features"><section className="panel feature-panel"><div className="panel-head"><div><small>تحكم مباشر</small><h2>ميزات NAVIXA</h2></div><button onClick={()=>tell("تم حفظ إعدادات الميزات")}>حفظ الكل</button></div>{features.map((f,i)=><div className="feature-row" key={f[0]}><span className={`feature-icon f${i}`}>{f[2]}</span><div><b>{f[0]}</b><small>{f[1]}</small></div><span className="use-count">{f[3]} مستخدم</span><label><input type="checkbox" checked={enabled[i]} onChange={()=>toggle(i)} aria-label={`تفعيل ${f[0]}`}/><i/></label></div>)}</section><section className="panel"><div className="panel-head"><div><small>إدارة المستخدمين</small><h2>إجراءات سريعة</h2></div></div><div className="admin-actions"><button onClick={()=>tell("فتح نموذج إضافة مستخدم")}>＋ إضافة مستخدم</button><button onClick={()=>tell("فتح إدارة الأدوار")}>♙ إدارة الأدوار</button><button onClick={()=>tell("تم تجهيز ملف التصدير")}>⇩ تصدير البيانات</button><button onClick={()=>tell("فتح طلبات حذف البيانات")}>⌫ طلبات الحذف</button></div></section></div>
      <section className="panel permissions-panel" id="permissions"><div className="panel-head"><div><small>صلاحيات المدير الأعلى</small><h2>كامل الصلاحيات</h2></div><span className="full-access">مفعّلة بالكامل</span></div><div className="permission-list">{permissions.map(p=><div className="permission-row" key={p[0]}><span>✓</span><div><b>{p[0]}</b><small>{p[1]}</small></div><em>كاملة</em><button onClick={()=>tell(`فتح إعدادات ${p[0]}`)}>إدارة</button></div>)}</div></section>
      <div className="admin-grid lower"><section className="panel" id="content"><div className="panel-head"><div><small>المحتوى</small><h2>إدارة تجربة المستخدم</h2></div></div><div className="admin-actions compact"><button onClick={()=>tell("فتح مكتبة التمارين")}>تمارين الحركة</button><button onClick={()=>tell("فتح رسائل التذكير")}>رسائل التذكير</button><button onClick={()=>tell("فتح الشارات")}>الشارات</button><button onClick={()=>tell("فتح المجتمع")}>المجتمع</button></div></section><section className="panel" id="integrations"><div className="panel-head"><div><small>التكاملات والخصوصية</small><h2>الخدمات المرتبطة</h2></div></div><div className="integration-list">{["Google Calendar","Looker Studio","إشعارات المتصفح","تحليل الوضعية المحلي"].map((x,i)=><div key={x}><i className={i<3?"ok":"warn"}/><b>{x}</b><small>{i<3?"جاهز":"تحت الإعداد"}</small><button onClick={()=>tell(`إدارة ${x}`)}>إدارة</button></div>)}</div></section></div>
      <section className="settings-group" id="settings"><div className="section-label"><small>الإعدادات</small><h2>تفضيلات النظام</h2></div><div className="settings-stack"><AdminHealthSettings/><AdminCounterSettings/><AdminAssistantSettings/><AdminAlertSettings/></div></section>
      <section className="panel activity-panel" id="activity"><div className="panel-head"><div><small>التدقيق</small><h2>آخر نشاط إداري</h2></div><button onClick={()=>tell("تم تجهيز سجل النشاط")}>تصدير السجل</button></div>{[["✓","تحديث صلاحيات مدير النظام","الآن"],["✦","تفعيل متابعة الأسماء","منذ 12 دقيقة"],["▣","مراجعة إعدادات الخصوصية","منذ 34 دقيقة"],["♙","تحديث دور مستخدم","منذ ساعة"]].map(r=><div className="log-row" key={r[1]}><span className="log-icon">{r[0]}</span><div><b>{r[1]}</b><small>تم بواسطة المدير الأعلى</small></div><time>{r[2]}</time></div>)}</section>
    </section></main>
}
