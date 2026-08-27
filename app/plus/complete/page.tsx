import type {Metadata} from "next";
import VerifyPayment from "./VerifyPayment";
import "../plus.css";

export const metadata:Metadata={title:"إتمام اشتراك NAVIXA Plus"};

export default function PaymentCompletePage({searchParams}:{searchParams:{intent?:string;id?:string;status?:string;provider?:string}}){
  return <VerifyPayment
    intentId={typeof searchParams.intent==="string"?searchParams.intent:""}
    paymentId={typeof searchParams.id==="string"?searchParams.id:""}
    status={typeof searchParams.status==="string"?searchParams.status:""}
    provider={typeof searchParams.provider==="string"?searchParams.provider:""}
  />;
}
