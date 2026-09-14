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
    aria:"فيديو شرح سماع نداء الاسم",
    title:"كيف يعمل سماع نداء الاسم؟",
    poster:"/tutorials/video-references/listen-name-reference.webp",
    video:"/tutorials/videos/listen-name-tutorial.mp4",
  },
  screen:{
    aria:"فيديو شرح متابعة الشاشة",
    title:"كيف تعمل متابعة الشاشة؟",
    poster:"/tutorials/video-references/screen-watch-reference.webp",
    video:"/tutorials/videos/screen-watch-tutorial.mp4",
  },
  meeting:{
    aria:"فيديو شرح لخّص اجتماعك",
    title:"كيف تلخّص اجتماعك؟",
    poster:"/tutorials/video-references/meeting-summary-reference.webp",
    video:"/tutorials/videos/meeting-summary-tutorial.mp4",
  },
} as const;

export default function HomeVideoModal({tutorialOpen,overviewVideoOpen,onCloseTutorial,onHideTutorial,onCloseOverview}:HomeVideoModalProps){
  const tutorial=tutorialOpen?tutorialCopy[tutorialOpen]:null;
  return <>
    {overviewVideoOpen&&<div className="navixa-overview-video-backdrop" role="presentation" onClick={onCloseOverview}><section className="navixa-overview-video-modal" role="dialog" aria-modal="true" aria-label="فيديو شرح NAVIXA" onClick={event=>event.stopPropagation()}><div className="navixa-overview-video-head"><div><small>NAVIXA SA</small><b>شاهد كيف يعمل NAVIXA</b></div><button type="button" aria-label="إغلاق فيديو الشرح" onClick={onCloseOverview}>×</button></div><video className="navixa-overview-video" controls playsInline preload="metadata" poster="/video/navixa-overview-primary-reference.webp"><source src="/video/final/navixa-overview-sync.mp4" type="video/mp4"/>متصفحك لا يدعم تشغيل الفيديو.</video><p>تعرف على سماع نداء الاسم، متابعة الشاشة، ولخّص اجتماعك — مع تحكمك الكامل في وقت التشغيل والأذونات.</p></section></div>}
    {tutorialOpen&&tutorial&&<div className="tutorial-modal-back" onClick={onCloseTutorial}><section className="tutorial-modal" aria-label={tutorial.aria} onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onCloseTutorial}>×</button><small>شرح سريع · 25 ثانية</small><h2>{tutorial.title}</h2><video controls playsInline preload="none" poster={tutorial.poster}><source src={tutorial.video} type="video/mp4"/>متصفحك لا يدعم تشغيل الفيديو.</video><div className="tutorial-modal-actions"><button onClick={onCloseTutorial}>فهمت، ابدأ الآن</button><button className="ghost" onClick={()=>onHideTutorial(tutorialOpen)}>لا تُظهر هذا الشرح مرة أخرى</button></div><p>يمكنك إعادة إظهاره في أي وقت من بطاقة الميزة نفسها.</p></section></div>}
  </>;
}
