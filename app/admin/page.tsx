"use client";

import Link from "next/link";
import { useState } from "react";
import "./admin.css";
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
import { useAdminAuth } from "./useAdminAuth";

const features = [
  ["سماع الاسم والكلمات", "الاستماع والتنبيه وإضافة المهام", "◉"],
  ["متابعة الشاشة", "مراقبة محلية بموافقة المستخدم", "▣"],
  ["الصحة والعافية", "الحركة والماء والتمارين الخفيفة", "♡"],
  ["المواعيد والمهام", "تذكيرات وتقويم وأتمتة", "▦"],
  ["جلسات التركيز", "مؤقت وتحسين الإنتاجية", "◎"],
  ["الاجتماعات والملخصات", "التفريغ والتلخيص والتصدير", "▤"],
] as const;

const permissions = [
  ["المستخدمون والأدوار", "إضافة وتعديل وإيقاف وتعيين الأدوار"],
  ["الميزات والخدمات", "تفعيل وتعطيل وضبط كل ميزة"],
  ["المحتوى والتمارين", "إنشاء وتعديل ونشر المحتوى"],
  ["التنبيهات والتقويم", "إدارة القوالب والجداول والتكاملات"],
  ["الخصوصية والبيانات", "الموافقات والتصدير والحذف"],
  ["السجلات والتقارير", "عرض ومراجعة سجل النشاط"],
] as const;

const navGroups = [
  { title: "الرئيسية", items: [["نظرة عامة", "overview", "⌂"]] },
  { title: "التشغيل", items: [["المميزات", "features", "✦"], ["المستخدمون", "users", "♙"], ["الصلاحيات", "permissions", "⌘"]] },
  { title: "الإدارة", items: [["المحتوى", "content", "▤"], ["التكاملات", "integrations", "⌁"], ["الإعدادات", "settings", "⚙"]] },
  { title: "المراجعة", items: [["السجل", "activity", "≡"], ["الخريطة الحرارية", "heatmap", "▦"]] },
] as const;

export default function AdminPage() {
  const { allowed, checking } = useAdminAuth();
  const [enabled, setEnabled] = useState(features.map(() => true));
  const [active, setActive] = useState("نظرة عامة");
  const [toast, setToast] = useState("");

  const tell = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const toggle = (index: number) => {
    const next = [...enabled];
    next[index] = !next[index];
    setEnabled(next);
    tell(`${features[index][0]}: ${next[index] ? "مفعّلة" : "متوقفة"}`);
  };

  const go = (name: string, id: string) => {
    setActive(name);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (checking || !allowed) return null;

  return (
    <main dir="rtl" className="admin-shell">
      {toast && <div className="toast" role="status">✓ {toast}</div>}

      <aside className="admin-side">
        <div className="logo">
          <span className="admin-logo-mark"><img src="/navixa-mark.png" alt="" /></span>
          <div><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>مركز الإدارة</small></div>
        </div>
        <div className="admin-badge">صلاحيات المدير الكاملة</div>

        <nav aria-label="أقسام الإدارة">
          {navGroups.map(group => (
            <div className="nav-group" key={group.title}>
              <small>{group.title}</small>
              {group.items.map(([name, id, icon]) => (
                <button key={name} className={active === name ? "on" : ""} onClick={() => go(name, id)}>
                  <i>{icon}</i><span>{name}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="nav-group nav-group-links">
            <small>أدوات إضافية</small>
            <button onClick={() => { window.location.href = "/admin/ads"; }}><i>▣</i><span>الإعلانات</span></button>
            <button onClick={() => { window.location.href = "/admin/emergency"; }}><i>!</i><span>الطوارئ</span></button>
            <button onClick={() => { window.location.href = "/admin/social"; }}><i>◎</i><span>التواصل</span></button>
          </div>
        </nav>

        <div className="admin-side-bottom">
          <Link href="/">← العودة إلى NAVIXA</Link>
          <div><span>س</span><p><b>سلطان</b><small>المدير الأعلى</small></p></div>
        </div>
      </aside>

      <section className="admin-page">
        <header className="admin-header" id="overview">
          <div>
            <small>مركز التحكم</small>
            <h1>إدارة NAVIXA <small className="title-sa">SA</small></h1>
            <p>كل ما تحتاجه لإدارة المنصة، مرتب في أقسام واضحة.</p>
          </div>
          <div className="admin-header-actions">
            <button className="status-button" onClick={() => tell("لا توجد أعطال حرجة")}>حالة النظام <i /></button>
            <Link href="/">عرض التطبيق ↗</Link>
          </div>
        </header>

        <section className="health-banner">
          <div><span className="health-icon">✓</span><div><small>الحالة الآن</small><h2>منصة NAVIXA تعمل بشكل طبيعي</h2><p>الخصوصية المحلية · الإدارة محمية · التنبيهات جاهزة</p></div></div>
          <div className="service-pills"><span><i /> الخصوصية</span><span><i /> المساعد</span><span><i /> التنبيهات</span><span><i /> الحسابات</span></div>
        </section>

        <section className="admin-status-grid" aria-label="حالة الخدمات">
          <article><span className="status-dot green" /><div><small>الموقع</small><b>متصل</b></div></article>
          <article><span className="status-dot purple" /><div><small>حماية الإدارة</small><b>مفعّلة</b></div></article>
          <article><span className="status-dot blue" /><div><small>التنبيهات</small><b>جاهزة</b></div></article>
          <article><span className="status-dot gold" /><div><small>الدومين</small><b>navixasa.com</b></div></article>
        </section>

        <section className="admin-section admin-fold" id="features"><details className="admin-fold-card"><summary><span>الميزات والتحكم المباشر</span><small>فعّل ما تحتاجه فقط</small></summary><div className="admin-fold-content"><div className="admin-grid">
          <section className="panel feature-panel">
            <div className="panel-head"><div><small>تحكم مباشر</small><h2>ميزات NAVIXA</h2></div><button onClick={() => tell("تم حفظ إعدادات الميزات")}>حفظ الإعدادات</button></div>
            <p className="panel-intro">فعّل الميزات التي تريد إتاحتها، واترك الباقي متوقفًا حتى تكتمل مراجعته.</p>
            {features.map((feature, index) => <div className="feature-row" key={feature[0]}><span className={`feature-icon f${index}`}>{feature[2]}</span><div><b>{feature[0]}</b><small>{feature[1]}</small></div><span className={enabled[index] ? "state active" : "state"}>{enabled[index] ? "مفعّلة" : "متوقفة"}</span><label><input type="checkbox" checked={enabled[index]} onChange={() => toggle(index)} aria-label={`تفعيل ${feature[0]}`} /><i /></label></div>)}
          </section>
          <section className="panel" id="users">
            <div className="panel-head"><div><small>اختصارات</small><h2>إجراءات سريعة</h2></div></div>
            <div className="admin-actions"><button onClick={() => tell("فتح نموذج إضافة مستخدم")}>＋ إضافة مستخدم</button><button onClick={() => tell("فتح إدارة الأدوار")}>♙ إدارة الأدوار</button><button onClick={() => tell("تم تجهيز ملف التصدير")}>⇩ تصدير البيانات</button><button onClick={() => tell("فتح طلبات حذف البيانات")}>⌫ طلبات الحذف</button></div>
          </section>
        </div></div></details></section>

        <section className="admin-section admin-fold" id="permissions"><details className="admin-fold-card"><summary><span>الصلاحيات والوصول</span><small>الأدوار وصلاحيات المدير</small></summary><div className="admin-fold-content"><section className="panel permissions-panel">
          <div className="panel-head"><div><small>الوصول</small><h2>صلاحيات المدير</h2></div><span className="full-access">كاملة</span></div>
          <p className="panel-intro">حساب المدير الأعلى يملك صلاحية إدارة جميع أقسام NAVIXA.</p>
          <div className="permission-list">{permissions.map(permission => <div className="permission-row" key={permission[0]}><span>✓</span><div><b>{permission[0]}</b><small>{permission[1]}</small></div><em>كاملة</em><button onClick={() => tell(`فتح إعدادات ${permission[0]}`)}>إدارة</button></div>)}</div>
        </section></div></details></section>

        <section className="admin-section admin-fold" id="content"><details className="admin-fold-card"><summary><span>المحتوى والخدمات المرتبطة</span><small>المحتوى والتكاملات</small></summary><div className="admin-fold-content">
          <div className="section-label"><small>إدارة المحتوى</small><h2>المحتوى وتجربة المستخدم</h2><p>اختصارات المحتوى التي تظهر داخل المنصة.</p></div>
          <div className="admin-grid lower"><section className="panel"><div className="admin-actions compact"><button onClick={() => tell("فتح مكتبة التمارين")}>تمارين الحركة</button><button onClick={() => tell("فتح رسائل التذكير")}>رسائل التذكير</button><button onClick={() => tell("فتح الشارات")}>الشارات</button><button onClick={() => tell("فتح المجتمع")}>المجتمع</button></div></section><section className="panel" id="integrations"><div className="panel-head"><div><small>الاتصال</small><h2>الخدمات المرتبطة</h2></div></div><div className="integration-list">{[["Google Calendar", "جاهز"], ["إشعارات المتصفح", "جاهز"], ["التحليل المحلي", "تحت الإعداد"]].map(([name, status], index) => <div key={name}><i className={index < 2 ? "ok" : "warn"} /><b>{name}</b><small>{status}</small><button onClick={() => tell(`إدارة ${name}`)}>إدارة</button></div>)}</div></section></div>
        </div></details></section>

        <section className="admin-section" id="settings">
          <div className="section-label"><small>إعدادات المنصة</small><h2>الإعدادات المنظمة</h2><p>افتح القسم الذي تريد تعديله فقط لتبقى الصفحة هادئة وسهلة.</p></div>
          <div className="settings-stack">
            <details className="settings-group"><summary>الحماية والدومين <span>الدخول · البريد · انتهاء النطاق</span></summary><div className="settings-group-content"><AdminDomainExpiryAlert /><AdminServiceTransitionSettings /><AdminUserAuthSettings /></div></details>
            <details className="settings-group"><summary>التنبيهات والمباريات <span>القنوات · القواعد · العرض</span></summary><div className="settings-group-content"><AdminAlertSettings /><AdminMatchSettings /></div></details>
            <details className="settings-group"><summary>المساعد والاجتماعات <span>الردود · التعلم · التلخيص</span></summary><div className="settings-group-content"><AdminAssistantSettings /><AdminAssistantLearningSettings /><AdminMeetingSettings /></div></details>
            <details className="settings-group"><summary>الصحة والمحتوى <span>العافية · العدادات · التمارين</span></summary><div className="settings-group-content"><AdminHealthSettings /><AdminCounterSettings /></div></details>
            <details className="settings-group"><summary>Plus والإحالات <span>الاشتراك · التجربة · المكافآت · الخصومات</span></summary><div className="settings-group-content"><AdminSubscriptionSettings /><AdminReferralSettings /><AdminDiscountCodes /></div></details>
          </div>
        </section>

        <section className="admin-section admin-fold" id="activity"><details className="admin-fold-card"><summary><span>سجل النشاط والمراجعة</span><small>آخر العمليات والقنوات</small></summary><div className="admin-fold-content"><AdminUsageAnalytics /><section className="panel activity-panel"><div className="panel-head"><div><small>المراجعة</small><h2>آخر النشاط</h2></div><button onClick={() => tell("تم تجهيز سجل النشاط")}>تصدير السجل</button></div><div className="log-row"><span className="log-icon">✓</span><div><b>تم تحديث إعدادات الإدارة</b><small>آخر تغيير محفوظ في النظام</small></div><time>الآن</time></div><div className="log-row"><span className="log-icon">⌁</span><div><b>قنوات التنبيه جاهزة للمراجعة</b><small>Telegram · البريد الإداري</small></div><time>اليوم</time></div></section></div></details></section>
        <section className="admin-section admin-fold" id="activity"><details className="admin-fold-card"><summary><span>سجل النشاط والمراجعة</span><small>الإيميلات · الاستخدام · التنبيهات</small></summary><div className="admin-fold-content"><AdminUsageAnalytics /><section className="panel activity-panel"><div className="panel-head"><div><small>المراجعة</small><h2>آخر النشاط</h2></div><button onClick={() => tell("تم تجهيز سجل النشاط")}>تصدير السجل</button></div><div className="log-row"><span className="log-icon">✓</span><div><b>تم تحديث إعدادات الإدارة</b><small>آخر تغيير محفوظ في النظام</small></div><time>الآن</time></div><div className="log-row"><span className="log-icon">⌁</span><div><b>قنوات التنبيه جاهزة للمراجعة</b><small>Telegram · البريد الإداري</small></div><time>اليوم</time></div></section></div></details></section>
        <section className="admin-section admin-fold" id="heatmap"><details className="admin-fold-card"><summary><span>الخريطة الحرارية</span><small>مناطق التفاعل المجمعة · قراءة مستقلة</small></summary><div className="admin-fold-content"><AdminUsageHeatmap /></div></details></section>
        <section className="admin-section admin-fold" id="site-health"><details className="admin-fold-card"><summary><span>صحة الموقع وتوافق CSP</span><small>فحص أسبوعي دفاعي · تقارير الحظر المجمعة</small></summary><div className="admin-fold-content"><AdminSiteHealth /></div></details></section>
      </section>
    </main>
  );
}
