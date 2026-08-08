"use client";
import {useEffect,useState} from "react";
const today=()=>new Date().toISOString().slice(0,10);
const tips=["ابدأ بأصغر مهمة، والزخم يبني نفسه.","خمس دقايق تركيز فعلي أفضل من ساعة تشتت.","خذ نفس عميق، ثم كمّل بهدوء.","إنجاز صغير اليوم أفضل من خطة مثالية مؤجلة.","راحة قصيرة الآن توفر لك تركيز أطول بعدها."];
const moods=[["great","😄","رائع"],["good","🙂","جيد"],["okay","😐","عادي"],["tired","😴","متعب"]] as const;

export default function DailyReviewCard({sessionsToday,tasksDone,tasksTotal,bestHour,onLogSession,onQuickTask}:{sessionsToday:number;tasksDone:number;tasksTotal:number;bestHour:string|null;onLogSession:()=>void;onQuickTask:()=>void}){
  const [mood,setMood]=useState("");
  const [wirdDone,setWirdDone]=useState(false);
  useEffect(()=>{setMood(localStorage.getItem(`navixa-mood-${today()}`)||"");setWirdDone(localStorage.getItem(`navixa-wird-${today()}`)==="1")},[]);
  const pickMood=(value:string)=>{setMood(value);localStorage.setItem(`navixa-mood-${today()}`,value)};
  const productivity=Math.max(0,Math.min(100,Math.round(sessionsToday*18+(tasksTotal?tasksDone/tasksTotal*40:0))));
  const dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0).getTime())/864e5);
  return <article className="insight-card daily-review">
    <header><span className="card-explain-icon">📊</span><div><small>مراجعة اليوم</small><h3>وش سويت اليوم؟</h3></div><span className="insight-badge">تقديري</span></header>
    <div className="review-stats">
      <div><b>{sessionsToday}</b><small>جلسات تركيز</small></div>
      <div><b>{tasksDone}/{tasksTotal}</b><small>مهام مكتملة</small></div>
      <div><b>{bestHour||"—"}</b><small>أفضل وقت لتركيزك</small></div>
      <div><b>{wirdDone?"✓":"—"}</b><small>ورد اليوم</small></div>
    </div>
    <div className="review-progress"><small>إنتاجية اليوم (تقديرية)</small><span><i style={{width:`${productivity}%`}}/></span><b>{productivity}%</b></div>
    <div className="review-mood"><small>كيف مزاجك اليوم؟</small><div>{moods.map(([value,icon,label])=><button key={value} type="button" className={mood===value?"active":""} onClick={()=>pickMood(value)} aria-label={label}>{icon}</button>)}</div></div>
    <p className="review-tip">💡 {tips[dayOfYear%tips.length]}</p>
    <div className="review-actions"><button type="button" onClick={onLogSession}>+1 جلسة</button><button type="button" className="ghost" onClick={onQuickTask}>+1 مهمة</button></div>
  </article>
}
