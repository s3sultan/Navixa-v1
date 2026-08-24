"use client";

import { useEffect, useState } from "react";

type OnboardingGuideProps = {
  onTryDemo: () => void;
};

const steps = [
  {
    eyebrow: "01 · افهم القيمة",
    title: "يومك أوضح مع NAVIXA SA",
    body: "سماع الاسم، متابعة الشاشة، وتلخيص الاجتماع في مساحة هادئة تساعدك على التقاط المهم.",
    icon: "✦",
  },
  {
    eyebrow: "02 · جرّب بأمان",
    title: "ابدأ بتجربة محلية",
    body: "استخدم المثال التجريبي لترى كيف تظهر المواعيد والمهام، دون رفع تسجيل أو مشاركة محتوى حساس.",
    icon: "⌁",
  },
  {
    eyebrow: "03 · فعّل ما يناسبك",
    title: "التنبيهات بقرارك",
    body: "احفظ تذكيراتك محليًا، أو اقرأ طريقة ربط Telegram اختياريًا عبر /start و /activate دون كشف أي رمز.",
    icon: "◌",
  },
];

export default function OnboardingGuide({ onTryDemo }: OnboardingGuideProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setOpen(localStorage.getItem("navixa-onboarding-complete") !== "1");
  }, []);

  const finish = () => {
    localStorage.setItem("navixa-onboarding-complete", "1");
    setOpen(false);
  };

  if (!open) return null;
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <section className="nx-onboarding" aria-labelledby="onboarding-title">
      <div className="nx-onboarding-glow" aria-hidden="true" />
      <div className="nx-onboarding-topline">
        <span>بداية هادئة مع NAVIXA SA</span>
        <button type="button" className="nx-onboarding-skip" onClick={finish}>تخطي الآن</button>
      </div>
      <div className="nx-onboarding-body">
        <div className="nx-onboarding-icon" aria-hidden="true">{current.icon}</div>
        <div className="nx-onboarding-copy">
          <small>{current.eyebrow}</small>
          <h2 id="onboarding-title">{current.title}</h2>
          <p>{current.body}</p>
          <div className="nx-onboarding-actions">
            {last ? (
              <>
                <button type="button" className="nx-onboarding-primary" onClick={() => { finish(); onTryDemo(); }}>جرّب المثال الآن</button>
                <button type="button" className="nx-onboarding-secondary" onClick={finish}>ابدأ من صفحتي</button>
              </>
            ) : (
              <button type="button" className="nx-onboarding-primary" onClick={() => setStep(value => value + 1)}>التالي</button>
            )}
          </div>
        </div>
      </div>
      <div className="nx-onboarding-progress" aria-label={`الخطوة ${step + 1} من ${steps.length}`}>
        {steps.map((item, index) => <span key={item.eyebrow} className={index === step ? "active" : ""} />)}
      </div>
    </section>
  );
}

export { steps };
