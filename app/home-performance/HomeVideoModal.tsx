"use client";

type TutorialKey="listener"|"screen"|"meeting";

type HomeVideoModalProps={
  tutorialOpen:TutorialKey|null;
  overviewVideoOpen:boolean;
  onCloseTutorial:()=>void;
  onHideTutorial:(key:TutorialKey)=>void;
  onCloseOverview:()=>void;
};

const tutorialCopy={
  listener:{
    title:"شرح الاستماع الذكي",
    body:"يراقب الكلمات أو الأسماء التي تحددها ويظهر تنبيهًا عند سماعها.",
    video:"/tutorial-listener.mp4",
  },
  screen:{
    title:"شرح متابعة الشاشة",
    body:"يراقب المنطقة التي تختارها على الشاشة وينبهك عند تغيرها.",
    video:"/tutorial-screen.mp4",
  },
  meeting:{
    title:"شرح الاجتماعات",
    body:"يسجل الصوت ويحوّله إلى نص وملخص ومهام قابلة للنسخ أو الطباعة.",
    video:"/tutorial-meeting.mp4",
  },
} as const;

export default function HomeVideoModal({tutorialOpen,overviewVideoOpen,onCloseTutorial,onHideTutorial,onCloseOverview}:HomeVideoModalProps){
  const tutorial=tutorialOpen?tutorialCopy[tutorialOpen]:null;
  return <>
    {tutorialOpen&&tutorial&&<div className="modal-back" onClick={onCloseTutorial}><div className="tutorial-modal" onClick={e=>e.stopPropagation()}><div className="account-panel-head"><div><h3>{tutorial.title}</h3><p>{tutorial.body}</p></div><button onClick={onCloseTutorial}>×</button></div><video controls preload="none" src={tutorial.video}/><div className="tutorial-actions"><button onClick={onCloseTutorial}>ابدأ الآن</button><button className="secondary" onClick={()=>onHideTutorial(tutorialOpen)}>لا تظهر هذا الشرح مرة أخرى</button></div></div></div>}
    {overviewVideoOpen&&<div className="modal-back overview-video-back" onClick={onCloseOverview}><div className="tutorial-modal overview-video-modal" onClick={e=>e.stopPropagation()}><div className="account-panel-head"><div><h3>فيديو NAVIXA</h3><p>شرح سريع للوضع الحالي والمنتج.</p></div><button onClick={onCloseOverview}>×</button></div><video controls autoPlay playsInline preload="none" src="/navixa-overview.mp4"/></div></div>}
  </>;
}
