"use client";

import { ar } from "../content/ar";
import { arCta } from "../content/cta/ar";
import { languageIdentity } from "../content/languages";

type HomeWelcomeProps={
  greeting:string;
  hideWelcomeForever:boolean;
  onEnter:()=>void;
  onOpenOverview:()=>void;
  onToggleForever:()=>void;
};

export default function HomeWelcome({greeting,hideWelcomeForever,onEnter,onOpenOverview,onToggleForever}:HomeWelcomeProps){
  return <section className="welcome" aria-label="لوحة ترحيب NAVIXA"><div className="welcome-pattern"/><div className="welcome-orb one"/><div className="welcome-orb two"/><div className="welcome-shell"><header className="welcome-head"><div className="navixa-logo-hero"><img src="/navixa-mark.webp" alt="شعار NAVIXA" /></div><div><small>{greeting}، {ar.home.welcome.greetingPrefix}</small><h1>{ar.home.welcome.titleLineOne}<br/><b>{ar.home.welcome.titleLineTwo}</b></h1></div></header><p className="welcome-intro">{ar.home.welcome.intro}</p><div className="welcome-content"><div className="welcome-priority-features"><article><span>◉</span><div><b>سماع نداء الاسم</b><small>اكتب الاسم الذي يهمك، وفعّل الاستماع عندما تريد أن ينبهك NAVIXA.</small></div></article><article><span>▣</span><div><b>متابعة الشاشة</b><small>راقب الشاشة كاملة أو حدّد جزءًا ترسمه بنفسك.</small></div></article><article><span>⌁</span><div><b>لخّص اجتماعك</b><small>سجّل، فرّغ، واستخرج أهم النقاط على جهازك.</small></div></article></div></div><div className="welcome-actions"><button type="button" className="welcome-enter" onClick={onEnter}><span>{arCta.startWithNavixa}</span><i>{languageIdentity.ar.arrow}</i></button><button type="button" className="welcome-overview-video" onClick={onOpenOverview}><span aria-hidden="true">▶</span><b>شاهد كيف يعمل NAVIXA</b><small>دقيقة واحدة توضح أهم المزايا</small></button><p className="welcome-assurance"><span>🔒</span> {ar.home.welcome.permissionAssurance}</p></div><footer className="welcome-footer"><label className="welcome-persistent-toggle"><input type="checkbox" checked={hideWelcomeForever} onChange={onToggleForever}/><span>{ar.home.welcome.hideForever}</span></label></footer></div></section>;
}
