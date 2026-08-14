export type PersonalReminderKind="water"|"break"|"eye";

export type PersonalReminderPrefs={
  enabled:boolean;
  browser:boolean;
  quietMinutes:number;
  water:boolean;
  break:boolean;
  eye:boolean;
};

export const DEFAULT_PERSONAL_REMINDER_PREFS:PersonalReminderPrefs={
  enabled:true,
  browser:false,
  quietMinutes:35,
  water:true,
  break:true,
  eye:true,
};

const STORAGE_KEY="navixa-personal-reminder-prefs";

export const getPersonalReminderPrefs=():PersonalReminderPrefs=>{
  try{return {...DEFAULT_PERSONAL_REMINDER_PREFS,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")} }catch{return {...DEFAULT_PERSONAL_REMINDER_PREFS}}
};

export const setPersonalReminderPrefs=(prefs:PersonalReminderPrefs)=>localStorage.setItem(STORAGE_KEY,JSON.stringify(prefs));
