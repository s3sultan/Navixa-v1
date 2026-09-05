"use client";

import {useEffect,useState} from "react";

type Prices={monthly:number;sprint:number;updatedAt?:string};
const headers={"Content-Type":"application/json"};

export default function AdminPlanPricing(){
  const [monthly,setMonthly]=useState("29");
  const [sprint,setSprint]=useState("11");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  const load=async()=>{const response=await fetch("/api/admin/plan-pricing",{cache:"no-store"});if(!response.ok)return;const data=await response.json() as {prices:Prices};setMonthly(String(data.prices.monthly/100));setSprint(String(data.prices.sprint/100))};
  useEffect(()=>{void load()},[]);

  const save=async()=>{
    setBusy(true);setNotice("");
    const response=await fetch("/api/admin/plan-pricing",{method:"POST",headers,body:JSON.stringify({monthlyRiyals:Number(monthly),sprintRiyals:Number(sprint)})});
    const data=await response.json().catch(()=>({})) as {error?:string;prices?:Prices;verification?:{message?:string}};
    setBusy(false);
    if(!response.ok){setNotice(data.error||"تعذر حفظ الأسعار");return}
    if(data.prices){setMonthly(String(data.prices.monthly/100));setSprint(String(data.prices.sprint/100))}
    setNotice(`✓ ${data.verification?.message||"تم حفظ الأسعار والتحقق منها"}`);
  };

  return <section className="panel admin-plan-pricing" aria-labelledby="admin-plan-pricing-title">
    <div className="panel-head"><div><small>الأسعار العامة · مرتبطة بالدفع</small><h2 id="admin-plan-pricing-title">هِمّة وعَزْم</h2><p>أي تعديل هنا يُحفظ في قاعدة البيانات، ثم يُعاد قراءته للتحقق. صفحة الأسعار ومسار الدفع يستخدمان القيمة نفسها من الخادم.</p></div><span className="full-access">تحقق خادمي</span></div>
    <div className="billing-grid">
      <label><b>هِمّة · شهر واحد</b><span>السعر بالريال</span><input inputMode="decimal" min="1" max="1000" step="0.01" type="number" value={monthly} onChange={e=>setMonthly(e.target.value)} aria-label="سعر همة بالريال" /></label>
      <label><b>عَزْم · خمسة أيام</b><span>السعر بالريال</span><input inputMode="decimal" min="1" max="1000" step="0.01" type="number" value={sprint} onChange={e=>setSprint(e.target.value)} aria-label="سعر عزم بالريال" /></label>
    </div>
    <div className="billing-actions"><button type="button" disabled={busy} onClick={()=>void save()}>{busy?"جارٍ الحفظ والتحقق…":"حفظ الأسعار والتحقق"}</button><a href="/pricing" target="_blank" rel="noreferrer">عرض قائمة الأسعار العامة ↗</a></div>
    {notice&&<p className="admin-inline-notice" role="status">{notice}</p>}
  </section>;
}
