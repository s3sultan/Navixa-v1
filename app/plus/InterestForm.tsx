"use client";

import {useState} from "react";

export default function InterestForm(){
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setNotice("");const response=await fetch("/api/plus/interest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email})});const data=await response.json().catch(()=>({}));setBusy(false);if(!response.ok){setNotice(data.error||"تعذر تسجيل الاهتمام الآن");return}setNotice(data.message||"تم تسجيل اهتمامك");setEmail("");setName("")};
  return <section className="plus-interest" id="interest"><div><small>أولوية التجربة</small><h2>كن من أوائل مستخدمي Plus</h2><p>أضف بريدك فقط. سنرسل دعوة تجريبية عندما تفتح التجارب، ولا يوجد دفع أو طلب بطاقة الآن.</p></div><form onSubmit={submit}><input value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم (اختياري)" maxLength={80}/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="بريدك الإلكتروني" type="email" required maxLength={160}/><button disabled={busy}>{busy?"جارٍ التسجيل…":"سجّل اهتمامك"}</button>{notice&&<p role="status">{notice}</p>}</form></section>;
}
