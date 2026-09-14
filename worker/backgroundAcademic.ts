import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import { deliverDueImportantReminders } from "./importantReminders";

type DbStatement={bind:(...values:unknown[])=>DbStatement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Db={prepare:(sql:string)=>DbStatement};
type AcademicSweepParams={sweepId:string;scheduledAt:string};
type AcademicQueuePayload={kind:"deliver_due_reminders";sweepId:string;scheduledAt:string};
type WorkflowBinding={create:(options:{id:string;params:AcademicSweepParams})=>Promise<{id:string}>};
type QueueProducer={send:(message:AcademicQueuePayload)=>Promise<void>};
export type AcademicQueueMessage={body:unknown;attempts:number;ack:()=>void;retry:(options?:{delaySeconds?:number})=>void};
export type AcademicQueueBatch={messages:AcademicQueueMessage[]};
export type AcademicBackgroundEnv={
  DB:Db;
  RESEND_API_KEY?:string;
  RESEND_FROM_EMAIL?:string;
  NAVIXA_AUTH_FROM?:string;
  NAVIXA_TELEGRAM_BOT_TOKEN?:string;
  NAVIXA_TELEGRAM_ENCRYPTION_KEY?:string;
  ACADEMIC_REMINDER_WORKFLOW?:WorkflowBinding;
  ACADEMIC_ALERT_QUEUE?:QueueProducer;
};

const minuteSweep=(scheduledTime?:number)=>{
  const candidate=typeof scheduledTime==="number"&&Number.isFinite(scheduledTime)?scheduledTime:Date.now();
  const date=new Date(candidate);
  date.setUTCSeconds(0,0);
  const scheduledAt=date.toISOString();
  return {scheduledAt,sweepId:`academic-${scheduledAt.replace(/[-:.TZ]/g,"")}`};
};

const isDuplicateWorkflowError=(error:unknown)=>{
  const message=error instanceof Error?error.message:String(error??"");
  return /already|exists|duplicate|unique/i.test(message);
};

export async function triggerAcademicReminderWorkflow(env:AcademicBackgroundEnv,scheduledTime?:number){
  const sweep=minuteSweep(scheduledTime);
  if(!env.ACADEMIC_REMINDER_WORKFLOW){
    const fallback=await deliverDueImportantReminders(env);
    return {mode:"fallback" as const,...sweep,...fallback};
  }
  try{
    await env.ACADEMIC_REMINDER_WORKFLOW.create({id:sweep.sweepId,params:sweep});
    return {mode:"workflow" as const,...sweep};
  }catch(error){
    if(isDuplicateWorkflowError(error))return {mode:"deduped" as const,...sweep};
    const fallback=await deliverDueImportantReminders(env);
    return {mode:"fallback" as const,...sweep,...fallback};
  }
}

export class AcademicReminderWorkflow extends WorkflowEntrypoint<AcademicBackgroundEnv,AcademicSweepParams>{
  async run(event:WorkflowEvent<AcademicSweepParams>,step:WorkflowStep){
    return step.do("queue due reminder delivery",async()=>{
      if(!this.env.ACADEMIC_ALERT_QUEUE)throw new Error("ACADEMIC_ALERT_QUEUE binding missing");
      const message:AcademicQueuePayload={kind:"deliver_due_reminders",sweepId:event.payload.sweepId,scheduledAt:event.payload.scheduledAt};
      await this.env.ACADEMIC_ALERT_QUEUE.send(message);
      return {queued:true,sweepId:event.payload.sweepId};
    });
  }
}

const validPayload=(value:unknown):value is AcademicQueuePayload=>{
  if(!value||typeof value!=="object")return false;
  const body=value as Partial<AcademicQueuePayload>;
  return body.kind==="deliver_due_reminders"&&typeof body.sweepId==="string"&&body.sweepId.startsWith("academic-")&&typeof body.scheduledAt==="string"&&Number.isFinite(Date.parse(body.scheduledAt));
};

export async function consumeAcademicReminderQueue(batch:AcademicQueueBatch,env:AcademicBackgroundEnv){
  let processed=0,delivered=0,retried=0,invalid=0;
  for(const message of batch.messages){
    if(!validPayload(message.body)){message.ack();invalid+=1;continue}
    try{
      const result=await deliverDueImportantReminders(env);
      message.ack();
      processed+=1;
      delivered+=result.delivered;
    }catch{
      const delaySeconds=Math.min(900,30*(2**Math.max(0,message.attempts-1)));
      message.retry({delaySeconds});
      retried+=1;
    }
  }
  return {processed,delivered,retried,invalid};
}
