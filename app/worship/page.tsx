"use client";
import Link from "next/link";
import WorshipCenter from "../WorshipCenter";
import FeatureAccessGate from "../FeatureAccessGate";
import "../navixa.css";
import "../worship-page.css";
export default function WorshipPage(){
  return <main className="worship-page" dir="rtl"><header><Link href="/">← العودة للرئيسية</Link><div><span>﷽</span><div><small>NAVIXA WORSHIP</small><h1>مركز الورد اليومي</h1><p>مواقيت الصلاة، الأذكار، وورد القرآن في مكان واحد.</p></div></div></header><FeatureAccessGate feature="مزايا الورد اليومي"><WorshipCenter/></FeatureAccessGate></main>
}
