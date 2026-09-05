import type {NavixaCapability,NavixaPlan} from "./planAccess";
export type AccessDecisionAudit={plan:NavixaPlan;capability:NavixaCapability;allowed:boolean;trialActive:boolean;at:string};
export function accessDecisionAudit(plan:NavixaPlan,capability:NavixaCapability,allowed:boolean,trialActive:boolean,now=new Date()):AccessDecisionAudit{return {plan,capability,allowed,trialActive,at:now.toISOString()};}
