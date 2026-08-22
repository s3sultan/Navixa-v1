import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NAVIXA SA — مساعدك الذكي، حاضر في التفاصيل التي تهمك";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        color: "white",
        background: "linear-gradient(135deg, #063f3e 0%, #0b836b 58%, #6d52c8 140%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ width: 84, height: 84, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 24, background: "white", color: "#0b765f", fontSize: 48, fontWeight: 800 }}>N</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, letterSpacing: 5, fontSize: 42, fontWeight: 800 }}>
          <span>NAVIXA</span><span style={{ marginTop: 7, color: "#e5dbff", letterSpacing: 2, fontSize: 18 }}>SA</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ color: "#e7ddff", fontSize: 31 }}>مساعدك الذكي، حاضر في التفاصيل التي تهمك</div>
        <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: -2 }}>خصوصية محلية. يوم أوضح.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
        <span>navixasa.com</span><span style={{ color: "#e7ddff" }}>NAVIXA SA</span>
      </div>
    </div>,
    size,
  );
}
