export type PersonalReminderKind="water"|"break"|"eye"|"academic";

export type PersonalReminderPrefs={
  enabled:boolean;
  browser:boolean;
  quietMinutes:number;
  water:boolean;
  break:boolean;
  eye:boolean;
  academic:boolean;
};

export const DEFAULT_PERSONAL_REMINDER_PREFS:PersonalReminderPrefs={enabled:true,browser:false,quietMinutes:35,water:true,break:true,eye:true,academic:true};
const STORAGE_KEY="navixa-personal-reminder-prefs";
const DISMISS_KEY="navixa-personal-reminder-dismissals";
const MAX_DISMISSALS=3;
type DismissalState=Partial<Record<PersonalReminderKind,{count:number;muted:boolean}>>;
const kinds:PersonalReminderKind[]=["water","break","eye","academic"];
const readDismissals=():DismissalState=>{try{return JSON.parse(localStorage.getItem(DISMISS_KEY)||"{}")}catch{return {}}};
const writeDismissals=(value:DismissalState)=>localStorage.setItem(DISMISS_KEY,JSON.stringify(value));

export const getPersonalReminderPrefs=():PersonalReminderPrefs=>{try{return {...DEFAULT_PERSONAL_REMINDER_PREFS,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")} }catch{return {...DEFAULT_PERSONAL_REMINDER_PREFS}}};
export const setPersonalReminderPrefs=(prefs:PersonalReminderPrefs)=>{const previous=getPersonalReminderPrefs(),dismissals=readDismissals();let changed=false;kinds.forEach(kind=>{if(!previous[kind]&&prefs[kind]&&dismissals[kind]){delete dismissals[kind];changed=true}});if(changed)writeDismissals(dismissals);localStorage.setItem(STORAGE_KEY,JSON.stringify(prefs))};
export const isPersonalReminderMuted=(kind:PersonalReminderKind)=>Boolean(readDismissals()[kind]?.muted);
export const dismissPersonalReminder=(kind:PersonalReminderKind)=>{const state=readDismissals(),current=state[kind]||{count:0,muted:false},count=Math.min(MAX_DISMISSALS,current.count+1),muted=count>=MAX_DISMISSALS;state[kind]={count,muted};writeDismissals(state);return {count,muted,remaining:Math.max(0,MAX_DISMISSALS-count)}};
export const resetPersonalReminderDismissals=(kind:PersonalReminderKind)=>{const state=readDismissals();delete state[kind];writeDismissals(state)};
