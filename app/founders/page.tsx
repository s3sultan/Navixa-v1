import type { Metadata } from "next";
import FoundersLanding from "./FoundersLanding";
import "./founders.css";

export const metadata: Metadata={
  title:"مؤسسو NAVIXA — سعر شخصي محدود",
  description:"نافذة مؤسسي NAVIXA: سعر شخصي محدود لأول شهر، يظهر قبل الدفع.",
};

export default function FoundersPage(){return <FoundersLanding/>}
