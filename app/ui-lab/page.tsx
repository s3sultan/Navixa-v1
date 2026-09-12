import type { Metadata } from "next";
import UILabClient from "./UILabClient";

export const metadata: Metadata = {
  title: "NAVIXA UI Lab",
  robots: { index: false, follow: false },
};

export default function UILabPage() {
  return <UILabClient />;
}
