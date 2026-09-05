import type {NavixaCapability,NavixaPlan} from "./planAccess";

export type TrustedAccessContext={plan:NavixaPlan;trialActive:boolean};
const AZM=new Set<NavixaCapability>(["screen-monitoring","name-call"]);

export function isCapabilityAllowed(context:TrustedAccessContext,capability:NavixaCapability){
  if(context.trialActive)return true;
  if(context.plan==="himma")return true;
  if(context.plan==="azm")return AZM.has(capability);
  return false;
}
