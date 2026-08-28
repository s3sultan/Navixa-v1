"use client";

import Link from "next/link";
import { useState } from "react";
import "./admin.css";
import "./dashboard-v2.css";
import AdminOverview from "./AdminOverview";
import AdminHealthSettings from "./settings/AdminHealthSettings";
import AdminCounterSettings from "./settings/AdminCounterSettings";
import AdminAssistantSettings from "./settings/AdminAssistantSettings";
import AdminAlertSettings from "./settings/AdminAlertSettings";
import AdminMatchSettings from "./settings/AdminMatchSettings";
import AdminAssistantLearningSettings from "./settings/AdminAssistantLearningSettings";
import AdminSubscriptionSettings from "./settings/AdminSubscriptionSettings";
import AdminUserAuthSettings from "./settings/AdminUserAuthSettings";
import AdminReferralSettings from "./settings/AdminReferralSettings";
import AdminDiscountCodes from "./settings/AdminDiscountCodes";
import AdminMeetingSettings from "./settings/AdminMeetingSettings";
import AdminDomainExpiryAlert from "./settings/AdminDomainExpiryAlert";
import AdminServiceTransitionSettings from "./settings/AdminServiceTransitionSettings";
import AdminUsageAnalytics from "./settings/AdminUsageAnalytics";
import AdminUsageHeatmap from "./settings/AdminUsageHeatmap";
import AdminSiteHealth from "./settings/AdminSiteHealth";
import AdminPerformanceDashboard from "./settings/AdminPerformanceDashboard";
import AdminRuntimeFeatureSettings from "./settings/AdminRuntimeFeatureSettings";
import { useAdminAuth } from "./useAdminAuth";

const permissions = [
  ["إعدادات المنصة", "التحكم بالإعدادات المتصلة ومفاتيح التشغيل"],
  ["الحسابات والوصول", "سياسات الدخول والتقارير المجمعة فقط"],
  ["الدعم الموحد", "مراجعة ومعالجة الطلبات في صندوق الدعم"],
  ["Plus والاشتراكات", "تفعيل إداري مؤقت دون تحصيل عام"],
  ["الصحة والأداء", "تقارير دفاعية وقياسات ميدانية مجمعة"],
  ["الأمان والخصوصية", "جلسة مدير محمية وحفظ محدود للبيانات"],
] as const;

const navGroups = [
  { title: "الرئيسية", items: [["نظرة عامة", "overview", "⌂"]] },
  { title: "التشغيل", items: [["مفاتيح الميزات", "features", "◈"], ["الوصول", "permissions", "◌"], ["العمليات", "content", "▤"]] },
  { title: "الإعداد", items: [["الإعدادات", "settings", "⚙"], ["الاشتراكات", "subscriptions", "✦"]] },
  { title: "المتابعة", items: [["الاستخدام", "activity", "≡"], ["الأداء", "performance", "↗"], ["الصحة", "site-health", "✓"], ["الخريطة", "heatmap", "▦"]] },
] as const;

export default function AdminPage() {
  const { allowed, checking } = useAdminAuth();
  const [active, setActive] = useState("نظرة عامة");
  const go = (name: string, id: string) => { setActive(name); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  if (checking || !allowed) return null;

  return <main dir="rtl" className="admin-shell dashboard-v2">
    <aside className="admin-side">
      <div className="logo"><span className="admin-logo-mark"><img src="/navixa-mark.png" alt="" /></span><div><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>لوحة التشغيل</small></div></div>
      <div className="admin-badge">جلسة إدارة محمية</div>
      <nav aria-label="أقسام الإدارة">{navGroups.map(group => <div className="nav-group" key={group.title}><small>{group.title}</small>{group.items.map(([name, id, icon]) => <button type="button" key={name} className={active === name ? "on" : ""} onClick={() => go(name, id)}><i>{icon}</i><span>{name}</span></button>)}</div>)}<div className="nav-group nav-group-links"><small>مساحات إضافية</small><button type="button" onClick={() => { window.location.href = "/admin/support"; }}><i>?</i><span>الدعم الموحد</span></button><button type="button" onClick={() => { window.location.href = "/admin/ads"; }}><i>▣</i><span>الإعلانات</span></button><button type="button" onClick={() => { window.location.href = "/admin/emergency"; }}><i>!</i><span>الطوارئ</span></button><button type="button" onClick={() => { window.location.href = "/admin/social"; }}><i>◎</i><span>التواصل</span></button></div></nav>
      <div className="admin-side-bottom"><Link href="/">← العودة إلى NAVIXA</Link><div><span>س</span><p><b>مدير NAVIXA</b><small>وصول إداري</small></p></div></div>
    </aside>

    <section className="admin-page">
      <header className="admin-header" id="overview"><div><small>NAVIXA / الإدارة</small><h1>لوحة التشغيل</h1><p>مؤشرات فعلية، إعدادات منظمة، ووصول مباشر إلى المهام المهمة.</p></div><div className="admin-header-actions"><button type="button" className="status-button" onClick={() => go("الصحة", "site-health")}>فحص الصحة <i /></button><Link href="/">عرض التطبيق ↗</Link></div></header>
      <AdminOverview onNavigate={go} />

      <section className="admin-section admin-fold" id="features"><details className="admin-fold-card"><summary><span>مفاتيح الميزات والتشغيل</span><small>تشغيل محسوب للميزات الثانوية</small></summary><div className="admin-fold-content"><AdminRuntimeFeatureSettings /></div></details></section>
      <section className="admin-section admin-fold" id="permissions"><details className="admin-fold-card"><summary><span>الوصول والصلاحيات</span><small>نطاق المدير والإعدادات المتصلة</small></summary><div className="admin-fold-content"><section className="panel permissions-panel"><div className="panel-head"><div><small>الوصول</small><h2>نطاق جلسة المدير</h2></div><span className="full-access">محمي</span></div><p className="panel-intro">هذه خريطة لحدود الوصول الحالية وليست محرر أدوار غير متصل.</p><div className="permission-list">{permissions.map(permission => <div className="permission-row" key={permission[0]}><span>✓</span><div><b>{permission[0]}</b><small>{permission[1]}</small></div><em>للمدير</em></div>)}</div></section></div></details></section>

      <section className="admin-section admin-fold" id="content"><details className="admin-fold-card"><summary><span>مركز العمليات</span><small>ابدأ من الأداة المتصلة المناسبة</small></summary><div className="admin-fold-content"><div className="operations-grid"><section className="operations-card"><small>الحسابات والتنبيهات</small><h2>إعداد الدخول والتذكيرات</h2><p>اضبط حسابات المستخدمين وقنوات التنبيه من الأقسام المتصلة، دون زر إجراءات شكلية.</p><div className="admin-actions"><button type="button" onClick={() => go("الإعدادات", "settings")}>فتح الإعدادات</button><button type="button" onClick={() => go("الاستخدام", "activity")}>عرض الاستخدام المجمع</button></div></section><section className="operations-card" id="integrations"><small>الحالة التجارية</small><h2>الدفع والتكاملات</h2><p>الدفع العام متوقف حاليًا حتى قبول مزود واحد واختبار الربط؛ لا تعرض هذه اللوحة أي قبول أو تحصيل غير مثبت.</p><div className="admin-actions"><button type="button" onClick={() => go("الاشتراكات", "subscriptions")}>فتح Plus</button><button type="button" onClick={() => { window.location.href = "/admin/support"; }}>الدعم الموحد</button></div></section></div></div></details></section>

      <section className="admin-section" id="settings"><div className="section-label"><small>إعدادات المنصة</small><h2>الإعدادات المنظمة</h2><p>افتح ما تحتاجه فقط لتبقى الإدارة هادئة وسهلة.</p></div><div className="settings-stack"><details className="settings-group"><summary>الحماية والدومين <span>الدخول · البريد · انتهاء النطاق</span></summary><div className="settings-group-content"><AdminDomainExpiryAlert /><AdminServiceTransitionSettings /><AdminUserAuthSettings /></div></details><details className="settings-group"><summary>التنبيهات والمباريات <span>القنوات · القواعد · العرض</span></summary><div className="settings-group-content"><AdminAlertSettings /><AdminMatchSettings /></div></details><details className="settings-group"><summary>المساعد والاجتماعات <span>الردود · التعلم · التلخيص</span></summary><div className="settings-group-content"><AdminAssistantSettings /><AdminAssistantLearningSettings /><AdminMeetingSettings /></div></details><details className="settings-group"><summary>الصحة والمحتوى <span>العافية · العدادات · التمارين</span></summary><div className="settings-group-content"><AdminHealthSettings /><AdminCounterSettings /></div></details><details className="settings-group" id="subscriptions"><summary>Plus والإحالات <span>الاشتراك · التجربة · المكافآت · الخصومات</span></summary><div className="settings-group-content"><AdminSubscriptionSettings /><AdminReferralSettings /><AdminDiscountCodes /></div></details></div></section>
      <section className="admin-section admin-fold" id="activity"><details className="admin-fold-card"><summary><span>الاستخدام والمراجعة</span><small>بيانات مجمعة وإعدادات احتفاظ</small></summary><div className="admin-fold-content"><AdminUsageAnalytics /></div></details></section>
      <section className="admin-section admin-fold" id="performance"><details className="admin-fold-card"><summary><span>أداء NAVIXA الأسبوعي</span><small>TTFB · LCP · INP · CLS</small></summary><div className="admin-fold-content"><AdminPerformanceDashboard /></div></details></section>
      <section className="admin-section admin-fold" id="site-health"><details className="admin-fold-card"><summary><span>صحة الموقع وتوافق CSP</span><small>فحص دفاعي وتقارير متوافقة</small></summary><div className="admin-fold-content"><AdminSiteHealth /></div></details></section>
      <section className="admin-section admin-fold" id="heatmap"><details className="admin-fold-card"><summary><span>الخريطة الحرارية</span><small>تفاعل مجمع دون محتوى خاص</small></summary><div className="admin-fold-content"><AdminUsageHeatmap /></div></details></section>
    </section>
  </main>;
}
