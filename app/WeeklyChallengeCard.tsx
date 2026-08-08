"use client";
const buildChallenges=(weekSessions:number,weekHydrationDays:number,tasksDone:number)=>[
  {id:"sessions",label:"أكمل 10 جلسات تركيز هذا الأسبوع",level:"متوسط",points:30,value:weekSessions,target:10},
  {id:"water",label:"حافظ على ترطيبك 5 أيام هذا الأسبوع",level:"سهل",points:15,value:weekHydrationDays,target:5},
  {id:"tasks",label:"أنجز 15 مهمة",level:"صعب",points:45,value:tasksDone,target:15},
];

export default function WeeklyChallengeCard({weekSessions,weekHydrationDays,tasksDone}:{weekSessions:number;weekHydrationDays:number;tasksDone:number}){
  const items=buildChallenges(weekSessions,weekHydrationDays,tasksDone);
  const totalPoints=items.reduce((sum,c)=>sum+(c.value>=c.target?c.points:0),0);
  const share=()=>{
    const text=`أنجزت هذا الأسبوع في NAVIXA: ${weekSessions} جلسة تركيز و${tasksDone} مهمة مكتملة 🚀`;
    const nav=navigator as Navigator&{share?:(data:{text:string})=>Promise<void>};
    if(nav.share)nav.share({text}).catch(()=>{});else navigator.clipboard?.writeText(text);
  };
  return <article className="insight-card weekly-challenge">
    <header><span className="card-explain-icon">🏆</span><div><small>التحدي الأسبوعي</small><h3>حافز أسبوعك</h3></div><span className="insight-badge points">{totalPoints} نقطة</span></header>
    <div className="challenge-list">{items.map(c=>{
      const pct=Math.min(100,Math.round(c.value/c.target*100));
      const done=c.value>=c.target;
      return <div key={c.id} className={done?"done":""}>
        <div className="challenge-head"><b>{c.label}</b><em>{c.level}</em></div>
        <span><i style={{width:`${pct}%`}}/></span>
        <small>{Math.min(c.value,c.target)}/{c.target}{done?" ✓ مكتمل":""}</small>
      </div>
    })}</div>
    <button type="button" className="share-challenge" onClick={share}>شارك إنجازك ↗</button>
  </article>
}
