"use client";

export default function CheckoutPanel() {
  return (
    <section className="plus-checkout" id="checkout" aria-labelledby="checkout-title">
      <header>
        <small>اشتراك NAVIXA Plus</small>
        <h2 id="checkout-title">الفترة الحالية مجانية للجميع</h2>
        <p>
          أسعار الاشتراكات وعروض المؤسسين مخفية مؤقتًا خلال الفترة المجانية، ولن يظهر أي سعر أو طلب دفع للمستخدم الآن.
        </p>
      </header>

      <div className="checkout-methods" aria-label="حالة الاشتراك">
        <span>كل المزايا متاحة للتجربة الآن</span>
        <span>الأسعار ستظهر عند فتح الاشتراكات رسميًا</span>
      </div>

      <p className="checkout-notice" role="status">
        عند انتهاء الفترة المجانية ستظهر الباقات المتاحة ومدتها وسعرها بوضوح قبل التسجيل أو الدفع.
      </p>

      <p className="checkout-footnote">
        لا تحفظ NAVIXA بيانات بطاقات أو محافظ. الدفع سيبقى متوقفًا حتى اعتماد مزود دفع رسمي وربط التحقق الخادمي الآمن.
      </p>
    </section>
  );
}
