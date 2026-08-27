"use client";

import { useSearchParams } from "next/navigation";

type Plan = "monthly" | "quarterly";

export default function CheckoutPanel() {
  const searchParams = useSearchParams();
  const foundersIntentId = searchParams.get("founders_intent") || "";
  const plan: Plan = foundersIntentId ? "monthly" : "monthly";

  return (
    <section className="plus-checkout" id="checkout" aria-labelledby="checkout-title">
      <header>
        <small>اشتراك NAVIXA Plus</small>
        <h2 id="checkout-title">التفعيل مؤقتًا من لوحة الإدارة فقط</h2>
        <p>
          أوقفنا التحويل إلى سلة مؤقتًا لأن صفحة الدفع هناك غير متاحة للعامة بسبب وضع الصيانة. لن يظهر للمستخدم زر دفع أو تحويل خارجي حتى تُعتمد بوابة دفع رسمية.
        </p>
      </header>

      <div className="checkout-options" role="radiogroup" aria-label="الباقة">
        <label className={plan === "monthly" ? "selected" : ""}>
          <input type="radio" name="plan" value="monthly" checked readOnly />
          <span>
            <b>Plus الشهري</b>
            <small>19 ر.س شهريًا عند فتح الدفع</small>
          </span>
        </label>
        <label aria-disabled="true">
          <input type="radio" name="plan" value="quarterly" disabled />
          <span>
            <b>باقة 3 + 1</b>
            <small>مؤجلة حتى اعتماد بوابة الدفع</small>
          </span>
        </label>
      </div>

      {foundersIntentId ? (
        <p className="checkout-notice">
          تم حفظ إشارة عرض المؤسسين لحسابك، لكن التحصيل العام متوقف مؤقتًا إلى أن تكتمل موافقة بوابة الدفع.
        </p>
      ) : null}

      <div className="checkout-methods" aria-label="حالة التفعيل">
        <span>لا يوجد تحويل إلى سلة</span>
        <span>التفعيل عبر لوحة الإدارة فقط</span>
      </div>

      <p className="checkout-notice" role="status">
        إذا تم منحك وصولًا تجريبيًا أو اشتراكًا يدويًا، سيظهر في حسابك بعد اعتماده من الإدارة. لا ترسل إيصالًا أو رقم طلب عبر هذه الصفحة.
      </p>

      <p className="checkout-footnote">
        لا تحفظ NAVIXA بيانات بطاقات أو محافظ. سيعود الدفع العام بعد اعتماد مزود دفع رسمي وربط التحقق الخادمي الآمن.
      </p>
    </section>
  );
}
