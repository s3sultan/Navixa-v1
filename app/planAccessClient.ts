import type {NavixaCapability,NavixaPlan} from "./planAccess";

export async function checkPlanCapability(plan:NavixaPlan,capability:NavixaCapability){
  const params=new URLSearchParams({plan,capability});
  const response=await fetch(`/api/access/entitlement?${params.toString()}`,{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)return false;
  const data=await response.json().catch(()=>null);
  return data?.allowed===true;
}
