"use client";

import { useState } from "react";
import {
  NavixaButton,
  NavixaCard,
  NavixaGrid,
  NavixaIconButton,
  NavixaShell,
  Overlay,
  type NavixaNavItem,
} from "../ui-system";
import styles from "./ui-lab.module.css";

type IconName = "home" | "tasks" | "calendar" | "health" | "more" | "bell" | "focus" | "water" | "voice";

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") return <svg {...common}><path d="M4 10.5L12 4l8 6.5V20H4z" /><path d="M9.5 20v-6h5v6" /></svg>;
  if (name === "tasks") return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6.2l1.2 1.2L7.5 5M4 12.2l1.2 1.2L7.5 11M4 18.2l1.2 1.2L7.5 17" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3v4M17 3v4M3.5 9.5h17" /></svg>;
  if (name === "health") return <svg {...common}><path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10z" /><path d="M8.5 12h2l1-2.2 1.5 4 1-1.8h2" /></svg>;
  if (name === "more") return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 20h4" /></svg>;
  if (name === "focus") return <svg {...common}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" /></svg>;
  if (name === "water") return <svg {...common}><path d="M12 3s5 5.2 5 10a5 5 0 0 1-10 0c0-4.8 5-10 5-10z" /></svg>;
  return <svg {...common}><path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" /><path d="M6.5 11.5v.5a5.5 5.5 0 0 0 11 0v-.5M12 17.5V21M9 21h6" /></svg>;
}

const navigation: NavixaNavItem[] = [
  { id: "today", label: "يومي", icon: <Icon name="home" />, active: true },
  { id: "tasks", label: "إنتاجيتي", icon: <Icon name="tasks" />, badge: 3 },
  { id: "meetings", label: "مواعيدي", icon: <Icon name="calendar" /> },
  { id: "health", label: "صحتي", icon: <Icon name="health" /> },
  { id: "more", label: "المزيد", icon: <Icon name="more" /> },
];

export default function UILabClient() {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <NavixaShell
      title="صباحك مرتب"
      subtitle="السبت 12 سبتمبر"
      navItems={navigation}
      actions={
        <NavixaIconButton label="عرض تفاصيل نظام الواجهة" onClick={() => setDetailsOpen(true)}>
          <Icon name="bell" />
        </NavixaIconButton>
      }
      sidebarFooter={
        <div className={styles.privacyStatus}>
          <span className={styles.privacyDot} aria-hidden="true" />
          <span>النظام يعمل من داخل NAVIXA</span>
        </div>
      }
    >
      <NavixaCard size="full">
        <div className={styles.hero}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>اليوم في NAVIXA</p>
            <h1 className={styles.heroTitle}>المهم أولًا، والباقي يظهر وقت الحاجة.</h1>
            <p className={styles.heroCopy}>
              هذه معاينة للنظام الجديد. نفس المحتوى يعيد ترتيب نفسه بوضوح على الجوال والتابلت والكمبيوتر، مع الحفاظ على هوية NAVIXA وتجربة واحدة متناسقة.
            </p>
            <div className={styles.actionRow}>
              <NavixaButton onClick={() => setDetailsOpen(true)}>كيف يعمل؟</NavixaButton>
              <NavixaButton variant="secondary">إضافة مهمة سريعة</NavixaButton>
            </div>
          </div>

          <div className={styles.signalCard} aria-label="حالة يومك">
            <div className={styles.signalTop}>
              <small>استعداد اليوم</small>
              <strong>مرتب وواضح</strong>
              <div className={styles.signalMeter} aria-hidden="true"><span /></div>
            </div>
            <div className={styles.signalBottom}>
              <span>3 مهام قريبة</span>
              <span>موعد واحد</span>
            </div>
          </div>
        </div>
      </NavixaCard>

      <div className={styles.sectionHead}>
        <div>
          <h2>نظرة سريعة</h2>
          <p>بطاقات تتغير أولويتها وحجمها حسب الشاشة.</p>
        </div>
        <span>يتكيف مع كل شاشة</span>
      </div>

      <NavixaGrid>
        <NavixaCard size="primary">
          <div className={styles.cardTitleRow}>
            <span className={styles.cardIcon}><Icon name="focus" /></span>
            <div>
              <h3>تركيزك الآن</h3>
              <small>جلسة العمل الحالية</small>
            </div>
          </div>
          <div className={styles.bigNumber}><strong>38</strong><span>دقيقة تركيز</span></div>
          <div className={styles.miniBar} aria-label="تقدم جلسة التركيز"><span style={{ width: "72%" }} /></div>
        </NavixaCard>

        <NavixaCard size="secondary">
          <div className={styles.cardTitleRow}>
            <span className={styles.cardIcon}><Icon name="water" /></span>
            <div>
              <h3>الماء والحركة</h3>
              <small>تذكير خفيف بلا إزعاج</small>
            </div>
          </div>
          <div className={styles.bigNumber}><strong>4</strong><span>أكواب اليوم</span></div>
          <div className={styles.miniBar} aria-label="تقدم شرب الماء"><span style={{ width: "55%" }} /></div>
        </NavixaCard>

        <NavixaCard size="half">
          <div className={styles.cardTitleRow}>
            <span className={styles.cardIcon}><Icon name="calendar" /></span>
            <div>
              <h3>القادم</h3>
              <small>ما يحتاج انتباهك فقط</small>
            </div>
          </div>
          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <div className={styles.timelineCopy}><strong>محاضرة الشبكات</strong><small>الاستماع للاسم جاهز</small></div>
              <span className={styles.timelineTime}>5:00 م</span>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <div className={styles.timelineCopy}><strong>مراجعة المهام</strong><small>3 عناصر قصيرة</small></div>
              <span className={styles.timelineTime}>7:30 م</span>
            </div>
          </div>
        </NavixaCard>

        <NavixaCard size="half">
          <div className={styles.cardTitleRow}>
            <span className={styles.cardIcon}><Icon name="voice" /></span>
            <div>
              <h3>جاهزية NAVIXA</h3>
              <small>الوظائف المهمة تبقى تحت إدارتنا</small>
            </div>
          </div>
          <ul className={styles.featureList}>
            <li><span className={styles.check} aria-hidden="true">✓</span><span>التنقل والاستجابة للشاشات من كود NAVIXA نفسه.</span></li>
            <li><span className={styles.check} aria-hidden="true">✓</span><span>الجوال يحصل على شريط تنقل سفلي وقائمة سحب مستقلة.</span></li>
            <li><span className={styles.check} aria-hidden="true">✓</span><span>التابلت له تخطيط متوسط بدل نسخة كمبيوتر مصغرة.</span></li>
          </ul>
        </NavixaCard>
      </NavixaGrid>

      <Overlay
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        variant="modal"
        title="نظام واجهة NAVIXA"
        description="نواة واجهة نملكها ونطورها بدون ربط تشغيل NAVIXA بمكتبة واجهات خارجية."
      >
        <div className={styles.modalBody}>
          <p className={styles.modalNote}>الجوال والتابلت والكمبيوتر يستخدمون المكونات نفسها، لكن كل حجم شاشة يأخذ ترتيبًا وتفاعلًا يناسبه.</p>
          <p className={styles.modalNote}>إذا تغيرت تقنيات المشروع لاحقًا، عقود المكونات تبقى واضحة ويمكن نقلها أو إعادة تنفيذها تدريجيًا.</p>
          <div className={styles.modalActions}>
            <NavixaButton variant="secondary" onClick={() => setDetailsOpen(false)}>إغلاق</NavixaButton>
          </div>
        </div>
      </Overlay>
    </NavixaShell>
  );
}
