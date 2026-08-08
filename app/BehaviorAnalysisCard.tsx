"use client";
const dayNames=["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];

export default function BehaviorAnalysisCard({weekly,sessionHours}:{weekly:{date:string;count:number}[];sessionHours:string[]}){
  const hourCounts:Record<number,number>={};
  const dayCounts:Record<number,number>={};
  sessionHours.forEach(iso=>{const d=new Date(iso);hourCounts[d.getHours()]=(hourCounts[d.getHours()]||0)+1;dayCounts[d.getDay()]=(dayCounts[d.getDay()]||0)+1});
  const bestHourEntry=Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0];
  const bestDayEntry=Object.entries(dayCounts).sort((a,b)=>b[1]-a[1])[0];
  const bestHour=bestHourEntry?`${bestHourEntry[0]}:00`:null;
  const bestDay=bestDayEntry?dayNames[Number(bestDayEntry[0])]:null;
  const total=sessionHours.length;
  const morning=Object.entries(hourCounts).filter(([h])=>Number(h)<12).reduce((sum,[,c])=>sum+c,0);
  const evening=Object.entries(hourCounts).filter(([h])=>Number(h)>=17).reduce((sum,[,c])=>sum+c,0);
  const pattern=total===0?"غير كافٍ":morning>=evening&&morning>total*.4?"صباحي":evening>morning&&evening>total*.4?"مسائي":"متوازن";
  const max=Math.max(1,...weekly.map(w=>w.count));
  const recommendation=total===0
    ?"سجّل بضع جلسات تركيز حتى نقدر نحلل نمطك بدقة."
    :pattern==="صباحي"?"أغلب تركيزك في الصباح — حاول تحجز أهم مهامك بأول اليوم."
    :pattern==="مسائي"?"طاقتك تعلى مساءً — خصص وقت المساء للمهام التي تحتاج تركيز عالي."
    :"تركيزك موزع بشكل متوازن على اليوم — استمر على هذا الإيقاع.";
  return <article className="insight-card behavior-analysis">
    <header><span className="card-explain-icon">🧭</span><div><small>تحليل السلوك</small><h3>كيف تتحرك خلال أسبوعك؟</h3></div><span className="insight-badge">تقديري</span></header>
    <div className="review-stats">
      <div><b>{bestHour||"—"}</b><small>أكثر وقت تركيز</small></div>
      <div><b>{bestDay||"—"}</b><small>أنشط يوم</small></div>
      <div><b>{pattern}</b><small>نمط تركيزك</small></div>
    </div>
    <div className="behavior-chart">{weekly.map(w=><div key={w.date}><span style={{height:`${Math.max(6,w.count/max*54)}px`}}/><small>{new Date(w.date).toLocaleDateString("ar",{weekday:"short"})}</small></div>)}</div>
    <p className="review-tip">🧭 {recommendation}</p>
  </article>
}
