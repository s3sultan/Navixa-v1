"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import "./navixa.css";

type Posture = "idle" | "loading" | "good" | "needs-care";

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const poorFrames = useRef(0);
  const goodFrames = useRef(0);

  const [monitoring, setMonitoring] = useState(false);
  const [posture, setPosture] = useState<Posture>("idle");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [breakEvery, setBreakEvery] = useState(30);
  const [waterEvery, setWaterEvery] = useState(60);
  const [waterCount, setWaterCount] = useState(0);
  const [message, setMessage] = useState("جاهز لبدء جلسة صحية");

  useEffect(() => {
    const saved = Number(localStorage.getItem("navixa-sitting-seconds") || 0);
    const water = Number(localStorage.getItem("navixa-water-count") || 0);
    setSessionSeconds(saved);
    setWaterCount(water);
  }, []);

  useEffect(() => {
    if (!monitoring) return;
    const timer = window.setInterval(() => {
      setSessionSeconds((value) => {
        const next = value + 1;
        localStorage.setItem("navixa-sitting-seconds", String(next));
        if (next > 0 && next % (breakEvery * 60) === 0) {
          setMessage(`جلست ${Math.floor(next / 60)} دقيقة — حان وقت التمدد`);
          if (Notification.permission === "granted") new Notification("NAVIXA", { body: "خذ دقيقة للحركة والتمدد" });
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [monitoring, breakEvery]);

  useEffect(() => () => stopMonitoring(false), []);

  const analyse = () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || !streamRef.current) return;

    if (video.currentTime !== lastVideoTime.current && video.readyState >= 2) {
      lastVideoTime.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const points = result.landmarks[0];
      if (points) {
        const leftEar = points[7];
        const rightEar = points[8];
        const leftShoulder = points[11];
        const rightShoulder = points[12];
        const shoulderWidth = Math.max(Math.abs(leftShoulder.x - rightShoulder.x), 0.05);
        const earY = (leftEar.y + rightEar.y) / 2;
        const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const neckHeight = (shoulderY - earY) / shoulderWidth;
        const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
        const isGood = neckHeight > 0.34 && shoulderTilt < 0.18;

        if (isGood) {
          goodFrames.current += 1;
          poorFrames.current = 0;
          if (goodFrames.current > 8) {
            setPosture("good");
            setMessage("جلستك متوازنة — استمر");
          }
        } else {
          poorFrames.current += 1;
          goodFrames.current = 0;
          if (poorFrames.current > 12) {
            setPosture("needs-care");
            setMessage("ارفع رأسك وأرخِ كتفيك قليلًا");
          }
        }
      }
    }
    frameRef.current = requestAnimationFrame(analyse);
  };

  const startMonitoring = async () => {
    try {
      setPosture("loading");
      setMessage("نجهّز التحليل المحلي…");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      setMonitoring(true);
      setPosture("good");
      setMessage("المراقبة تعمل محليًا على جهازك");
      if (Notification.permission === "default") void Notification.requestPermission();
      analyse();
    } catch {
      stopMonitoring(false);
      setPosture("idle");
      setMessage("تعذر تشغيل الكاميرا — تحقق من الصلاحية");
    }
  };

  const stopMonitoring = (showMessage = true) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setMonitoring(false);
    setPosture("idle");
    if (showMessage) setMessage("توقفت الكاميرا والمراقبة فورًا");
  };

  const drinkWater = () => {
    const next = waterCount + 1;
    setWaterCount(next);
    localStorage.setItem("navixa-water-count", String(next));
    setMessage("صحة وعافية — تم تسجيل كوب ماء");
  };

  return (
    <main className="health-app" dir="rtl">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="NAVIXA"><span>ن</span><b>NAVIXA</b></a>
        <nav aria-label="التنقل الرئيسي"><a href="#monitor">الجلسة</a><a href="#habits">صحتي</a><a href="/admin/login">الإدارة</a></nav>
        <button className="emergency" onClick={() => stopMonitoring()}>إيقاف فوري</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">رفيق صحتك أثناء العمل</span>
          <h1>اجلس بوعي.<br/><em>وتحرّك في وقتك.</em></h1>
          <p>يراقب NAVIXA وضعية جلوسك داخل جهازك، ويذكّرك بالحركة والماء بلطف.</p>
          <div className="privacy-pill"><i/> لا صور محفوظة · لا فيديو مرفوع · التحكم لك</div>
        </div>
        <div className="session-card">
          <small>مدة جلوسك اليوم</small>
          <strong>{formatTime(sessionSeconds)}</strong>
          <span className={`posture-status ${posture}`}><i/>{message}</span>
          <div className="session-actions">
            {!monitoring ? <button className="primary" onClick={startMonitoring}>ابدأ المراقبة</button> : <button className="primary stop" onClick={() => stopMonitoring()}>إنهاء الجلسة</button>}
            <button onClick={() => { setSessionSeconds(0); localStorage.setItem("navixa-sitting-seconds", "0"); }}>تصفير العداد</button>
          </div>
        </div>
      </section>

      <section className="monitor-grid" id="monitor">
        <article className="camera-card">
          <div className="card-head"><div><small>تحليل الوضعية</small><h2>كاميرتك، داخل جهازك فقط</h2></div><span className={monitoring ? "live" : "off"}>{monitoring ? "يعمل الآن" : "متوقف"}</span></div>
          <div className="video-shell">
            <video ref={videoRef} muted playsInline />
            {!monitoring && <div className="camera-empty"><span>◉</span><b>الكاميرا متوقفة</b><small>لن تبدأ إلا بعد موافقتك</small></div>}
            {monitoring && <div className="scan-line"/>}
          </div>
          <p className="local-note">يحلل النموذج نقاط الجسم مباشرة في المتصفح، ولا يرسل الفيديو لأي خادم.</p>
        </article>

        <div className="side-cards" id="habits">
          <article className="habit-card break-card"><span>↗</span><div><small>الحركة القادمة</small><h3>تمدد خفيف لدقيقة</h3><p>حرّك كتفيك للخلف ثم قف بهدوء.</p></div><label>كل <select value={breakEvery} onChange={(e) => setBreakEvery(Number(e.target.value))}><option value="20">20</option><option value="30">30</option><option value="45">45</option><option value="60">60</option></select> دقيقة</label></article>
          <article className="habit-card water-card"><span>◌</span><div><small>الماء اليوم</small><h3>{waterCount} أكواب</h3><p>تذكير قابل للتعديل حسب يومك.</p></div><label>كل <select value={waterEvery} onChange={(e) => setWaterEvery(Number(e.target.value))}><option value="30">30</option><option value="60">60</option><option value="90">90</option></select> دقيقة</label><button onClick={drinkWater}>شربت كوبًا</button></article>
          <article className="privacy-card"><div className="shield">✓</div><div><small>خصوصيتك أولًا</small><h3>المعالجة محلية 100%</h3><p>يمكنك إيقاف الكاميرا فورًا من أعلى الصفحة.</p></div></article>
        </div>
      </section>

      <footer><b>NAVIXA</b><span>رفيق يوم صحي ومنتج</span><small>المؤشرات إرشادية وليست تشخيصًا طبيًا.</small></footer>
    </main>
  );
}
