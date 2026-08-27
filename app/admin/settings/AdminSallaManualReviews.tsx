"use client";

import { useEffect, useState } from "react";

type Review = { id: string; checkout_intent_id: string; status: "pending" | "processing"; created_at: string; email: string };
type Expected = { productId: string; amountMinor: number; currency: string };
const headers = { "Content-Type": "application/json" };

export default function AdminSallaManualReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expected, setExpected] = useState<Expected>({ productId: "41013139", amountMinor: 1900, currency: "SAR" });
  const [orderIds, setOrderIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const load = async () => { const response = await fetch("/api/admin/salla-manual-reviews", { cache: "no-store" }); const data = await response.json().catch(() => ({})); if (response.ok) { setReviews(data.reviews || []); if (data.expected) setExpected(data.expected); } else setNotice(data.error || "تعذر تحميل المراجعات"); };
  useEffect(() => { void load(); }, []);
  const approve = async (review: Review) => {
    const sallaOrderId = (orderIds[review.id] || "").trim();
    if (!sallaOrderId) { setNotice("أدخل رقم طلب سلة بعد إتمام التحقق اليدوي فقط"); return; }
    setBusy(review.id); setNotice("");
    const response = await fetch("/api/admin/salla-manual-reviews", { method: "POST", headers, body: JSON.stringify({ reviewId: review.id, sallaOrderId }) });
    const data = await response.json().catch(() => ({})); setBusy(""); setNotice(response.ok ? (data.message || "تم التفعيل") : (data.error || "تعذر التفعيل")); if (response.ok) await load();
  };
  return <section className="panel subscription-admin" aria-label="مراجعة سلة اليدوية"><div className="panel-head"><div><small>سلة Plus · مراجعة يدوية</small><h2>طلبات تفعيل اشتراك سلة</h2><p>لا يفعّل هذا القسم أي طلب تلقائيًا. راجع الطلب المدفوع داخل سلة أولًا، ثم طابق البريد والمنتج والمبلغ قبل التفعيل مرة واحدة.</p></div><button onClick={() => void load()}>تحديث</button></div>{notice && <p className="admin-inline-notice">{notice}</p>}<p className="checkout-notice"><b>شرط التفعيل:</b> حالة الطلب مدفوع في سلة، المنتج {expected.productId}، المبلغ {(expected.amountMinor / 100).toFixed(2)} {expected.currency}، وبريد العميل في سلة يطابق البريد أدناه. لا تقبل صورة إيصال أو رسالة من العميل كبديل عن لوحة سلة.</p><div className="subscription-table-wrap"><table><thead><tr><th>حساب NAVIXA</th><th>وقت الطلب</th><th>رقم طلب سلة</th><th>إجراء بعد التحقق</th></tr></thead><tbody>{reviews.length ? reviews.map(review => <tr key={review.id}><td><small>{review.email}</small></td><td>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(review.created_at))}</td><td><input value={orderIds[review.id] || ""} onChange={event => setOrderIds(previous => ({ ...previous, [review.id]: event.target.value }))} placeholder="من لوحة سلة فقط" aria-label={`رقم طلب سلة للحساب ${review.email}`} /></td><td><button disabled={busy === review.id || review.status !== "pending"} onClick={() => void approve(review)}>{busy === review.id ? "جارٍ التفعيل…" : "تحققت من سلة · فعّل Plus"}</button></td></tr>) : <tr><td colSpan={4} className="subscription-empty">لا توجد طلبات معلقة. يظهر الطلب هنا فقط بعد أن يبدأ العميل انتقاله إلى سلة وهو مسجل في NAVIXA.</td></tr>}</tbody></table></div></section>;
}
