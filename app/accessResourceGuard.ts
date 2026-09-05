import type {NavixaPlan} from "./planAccess";
import {usageLimitFor,type HeavyCapability} from "./accessUsagePolicy";
export function resourceGuard(plan:NavixaPlan,trialActive:boolean,capability:HeavyCapability,used:number){const limit=usageLimitFor(plan,trialActive,capability);const safeUsed=Number.isFinite(used)&&used>=0?used:Number.POSITIVE_INFINITY;return {allowed:limit>0&&safeUsed<limit,limit,remaining:Math.max(0,limit-safeUsed)};}
