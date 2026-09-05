import type {NavixaCapability,NavixaPlan} from "./planAccess";
import {isCapabilityAllowed} from "./planAccessPolicy";
import {getLaunchTrialStatus} from "./launchTrialServer";

export function enforceCapability(plan:NavixaPlan,capability:NavixaCapability,now=new Date()){
  const trial=getLaunchTrialStatus(now);
  return {allowed:isCapabilityAllowed({plan,trialActive:trial.active},capability),trial};
}
