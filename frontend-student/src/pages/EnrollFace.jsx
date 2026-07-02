// pages/etudiant/EnrollFace.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as faceapi from "@vladmandic/face-api";
import api from "../utils/api";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

const ZONES = [
  { id: "face",   yaw:   6, pitch: 36, tol: 26, angle: 270, label: "Face",   guide: "Regardez bien l'écran" },
  { id: "droite", yaw: -32, pitch: 27, tol: 36, angle: 0,   label: "Droite", guide: "Tournez la tête vers la DROITE" },
  { id: "bas",    yaw:   0, pitch: 65, tol: 30, angle: 90,  label: "Bas",    guide: "Baissez légèrement la tête" },
  { id: "gauche", yaw:  32, pitch: 31, tol: 36, angle: 180, label: "Gauche", guide: "Tournez la tête vers la GAUCHE" },
  { id: "haut",   yaw:  -4, pitch: 20, tol: 26, angle: 315, label: "Haut",   guide: "Levez légèrement la tête" },
];

const SMOOTH_WINDOW = 4;

const NO_FACE_HINT_THRESHOLD = 18; 

const RING_CIRC = 2 * Math.PI * 48;

export default function EnrollFace() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const capturedSet = useRef(new Set());
  const isSending = useRef(new Set());
  const lastUpdate = useRef(0);
  const detectingRef = useRef(false);

  const poseHistory = useRef([]);
  const noFaceStreak = useRef(0);

  const navigate = useNavigate();
  const [doneIds, setDoneIds] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [hint, setHint] = useState("Vérification...");
  const [isCapturing, setIsCapturing] = useState(false);

  const [canCapture, setCanCapture] = useState(false);
  const [faceLost, setFaceLost] = useState(false);

  const updateOverallProgress = useCallback((count) => {
    setProgress((count / ZONES.length) * 100);
    setIsDone(count === ZONES.length);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/etudiant/enroll/status");
        const faites = data.positions_faites || [];
        capturedSet.current = new Set(faites);
        setDoneIds(faites);
        updateOverallProgress(faites.length);

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        setHint("Modèles chargés");
      } catch {
        setHint("Accès caméra requis");
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [updateOverallProgress]);

  const handleStart = () => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
    setIsStarted(true);
    setHint("Suivez les instructions");
  };

  const getPose = useCallback((lm) => {
    const p = lm.positions;
    const eyeCX = (p[36].x + p[45].x) / 2;
    const eyeCY = (p[36].y + p[45].y) / 2;
    const eyeDist = Math.max(p[45].x - p[36].x, 1);
    const yaw = ((p[30].x - eyeCX) / eyeDist) * 100;
    const pitch = ((p[30].y - eyeCY) / eyeDist) * 100;
    return { yaw, pitch };
  }, []);

  const getSmoothedPose = useCallback((rawPose) => {
    poseHistory.current.push(rawPose);
    if (poseHistory.current.length > SMOOTH_WINDOW) {
      poseHistory.current.shift();
    }
    const n = poseHistory.current.length;
    const sum = poseHistory.current.reduce(
      (acc, p) => ({ yaw: acc.yaw + p.yaw, pitch: acc.pitch + p.pitch }),
      { yaw: 0, pitch: 0 }
    );
    return { yaw: sum.yaw / n, pitch: sum.pitch / n };
  }, []);

  const handleCapture = useCallback(async (id) => {
    if (isSending.current.has(id)) return;
    if (navigator.vibrate) navigator.vibrate(40);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.6));

    isSending.current.add(id);
    setIsCapturing(true);
    const fd = new FormData();
    fd.append("photos", blob, `${id}.jpg`);

    try {
      setHint("Analyse en cours...");
      await api.post(`/etudiant/enroll/${id}`, fd);
      capturedSet.current.add(id);
      const current = Array.from(capturedSet.current);
      setDoneIds(current);
      updateOverallProgress(current.length);
      setHint("Position validée !");
      setCanCapture(false);
      poseHistory.current = [];
    } catch (err) {
      setHint(err.response?.data?.detail || "Erreur de capture, réessayez");
    } finally {
      isSending.current.delete(id);
      setIsCapturing(false);
    }
  }, [updateOverallProgress]);

  const handleCaptureClick = useCallback(() => {
    const target = ZONES.find(z => !capturedSet.current.has(z.id));
    if (!target) return;
    if (!canCapture || isCapturing || isSending.current.has(target.id)) return;
    handleCapture(target.id);
  }, [canCapture, isCapturing, handleCapture]);

  useEffect(() => {
    if (!modelsLoaded || !isStarted || isDone) return;

    const loop = async (ts) => {
      animFrameRef.current = requestAnimationFrame(loop);

      if (ts - lastUpdate.current < 33) return; 
      if (detectingRef.current) return;
      lastUpdate.current = ts;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const target = ZONES.find(z => !capturedSet.current.has(z.id));
      if (!target) return;

      detectingRef.current = true;
      try {
        const det = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 })).withFaceLandmarks();

        if (!det) {
          noFaceStreak.current += 1;
          if (noFaceStreak.current >= NO_FACE_HINT_THRESHOLD) {
            setFaceLost(true);
            setCanCapture(false);
          }
          return;
        }

        noFaceStreak.current = 0;
        setFaceLost(false);

        const rawPose = getPose(det.landmarks);
        const { yaw, pitch } = getSmoothedPose(rawPose);

        const dy = Math.abs(yaw - target.yaw);
        const dp = Math.abs(pitch - target.pitch);
        const isInTargetZone = dy < target.tol && dp < target.tol;

        setCanCapture(isInTargetZone);
      } catch {
        // Détection ignorée pour cette frame
      } finally {
        detectingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [modelsLoaded, isStarted, isDone, getPose, getSmoothedPose]);

  const handleReset = async (e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Tout recommencer ?")) return;
    try {
      setHint("Réinitialisation...");
      await api.delete("/etudiant/enroll/reset");
      capturedSet.current = new Set();
      isSending.current = new Set();
      poseHistory.current = [];
      noFaceStreak.current = 0;
      setFaceLost(false);
      setCanCapture(false);
      setDoneIds([]);
      setProgress(0);
      setIsDone(false);
      setHint("Prêt");
    } catch {
      setHint("Erreur reset");
    }
  };

  const nextPos = ZONES.find(z => !doneIds.includes(z.id));

  return (
    <div style={s.page}>
      <style>{`
        @keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      <nav style={s.nav}>
        <button style={s.backBtn} onClick={() => navigate("/profile")}>✕</button>
        <span style={s.navTitle}>Configuration Face ID</span>
        <div style={{width: 40}} />
      </nav>

      <main style={s.main}>
        <ol style={s.posList}>
          {ZONES.map((z) => {
            const done = doneIds.includes(z.id);
            const isCurrent = !done && nextPos?.id === z.id;
            return (
              <li key={z.id} style={{
                ...s.posItem,
                ...(isCurrent ? s.posItemCurrent : {}),
              }}>
                <span style={{
                  ...s.posIcon,
                  ...(done ? s.posIconDone : isCurrent ? s.posIconCurrent : s.posIconTodo),
                }}>
                  {done ? "✔" : isCurrent ? "●" : "○"}
                </span>
                <span style={{
                  ...s.posLabel,
                  ...(done ? s.posLabelDone : isCurrent ? s.posLabelCurrent : s.posLabelTodo),
                }}>
                  {z.label}
                </span>
                {isCurrent && <span style={s.posCurrentTag}>en cours</span>}
              </li>
            );
          })}
        </ol>

        <div style={s.camWrapper}>
          <svg style={s.svgRing} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#f5f5f5" strokeWidth="2" />
            <circle cx="50" cy="50" r="48" fill="none" stroke="#5b4afd" strokeWidth="3"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC - (RING_CIRC * progress) / 100}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s ease", transform: "rotate(-90 50 50)" }}
            />
            
            {canCapture && (
              <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="3"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={0}
                strokeLinecap="round"
                style={{ transition: "opacity 0.15s ease", transform: "rotate(-90 50 50)" }}
              />
            )}
          </svg>

          <div style={s.camCircle}>
            <video ref={videoRef} autoPlay playsInline muted style={s.video} />
            {isStarted && !isDone && <div style={s.scanLine} />}

            {!isStarted && modelsLoaded && (
              <div style={s.overlay}>
                <button style={s.btnStart} onClick={handleStart}>Démarrer</button>
              </div>
            )}

            {isDone && (
              <div style={s.doneOverlay}>
                <div style={s.checkMark}>✓</div>
                <p style={{fontWeight: 700, margin: "10px 0"}}>Configuration Terminée</p>
                <button style={s.btnResetSmall} onClick={handleReset}>Réinitialiser</button>
              </div>
            )}
          </div>
        </div>

        <div style={s.hintArea}>
          {isStarted && !isDone ? (
            faceLost ? (
              <div style={s.faceLostBox}>
                <p style={s.faceLostTitle}>Visage non détecté</p>
                <p style={s.subHint}>Rapprochez-vous ou améliorez l'éclairage</p>
              </div>
            ) : (
              <>
                <p style={s.stepTag}>Étape {doneIds.length + 1} / {ZONES.length}</p>
                <h2 style={s.mainHint}>
                  {canCapture ? "Position correcte !" : (nextPos ? nextPos.guide : "Analyse...")}
                </h2>
                <p style={s.subHint}>Position : {nextPos?.label}</p>
              </>
            )
          ) : (
            <>
              <h2 style={s.mainHint}>Bienvenue</h2>
              <p style={s.subHint}>{hint}</p>
            </>
          )}
        </div>


        {isStarted && !isDone && !faceLost && (
          <button
            style={{
              ...s.btnCapture,
              ...(canCapture && !isCapturing ? s.btnCaptureActive : s.btnCaptureDisabled),
            }}
            onClick={handleCaptureClick}
            disabled={!canCapture || isCapturing}
          >
            {isCapturing ? "Capture..." : "Capturer"}
          </button>
        )}
      </main>

      <footer style={s.footer}>
        {isDone ? (
          <button style={s.btnFinish} onClick={() => navigate("/profile")}>Terminer</button>
        ) : isStarted ? (
          <button style={s.btnResetLink} onClick={handleReset}>Réinitialiser tout</button>
        ) : null}
      </footer>
      <canvas ref={canvasRef} style={{display:"none"}} />
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f8fafc", color: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "sans-serif" },
  nav: { height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid #e5e7ef", background: "#fff" },
  backBtn: { border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#5b4afd" },
  navTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a2e" },

  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" },

  posList: { listStyle: "none", margin: "0 0 26px", padding: 0, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 360 },
  posItem: { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "#fff", border: "1px solid #ececf3" },
  posItemCurrent: { background: "#f1effe", border: "1px solid #5b4afd" },
  posIcon: { fontSize: 14, fontWeight: 700, lineHeight: 1, width: 16, textAlign: "center" },
  posIconDone: { color: "#10b981" },
  posIconCurrent: { color: "#5b4afd" },
  posIconTodo: { color: "#c4c4ce" },
  posLabel: { fontSize: 13.5, fontWeight: 600 },
  posLabelDone: { color: "#10b981" },
  posLabelCurrent: { color: "#5b4afd" },
  posLabelTodo: { color: "#9a9aa8" },
  posCurrentTag: { fontSize: 10.5, fontWeight: 700, color: "#5b4afd", background: "#e3e0ff", borderRadius: 10, padding: "2px 7px", textTransform: "uppercase", letterSpacing: 0.3 },

  camWrapper: { position: "relative", width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  svgRing: { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2 },
  camCircle: { width: 230, height: 230, borderRadius: "50%", overflow: "hidden", position: "relative", border: "1px solid #efefef", boxShadow: "0 8px 24px rgba(0,0,0,0.03)" },
  video: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" },
  scanLine: { position: "absolute", inset: 0, height: 2, background: "#5b4afd", animation: "scanline 2s infinite" },

  overlay: { position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 },
  btnStart: { background: "#5b4afd", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(91,74,253,0.2)" },

  doneOverlay: {
    position: "absolute",
    inset: 0,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20
  },
  checkMark: { width: 50, height: 50, borderRadius: "50%", background: "#10b981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold" },
  btnResetSmall: { background: "#f3f4f6", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 15 },

  hintArea: { textAlign: "center", minHeight: 80 },
  stepTag: { fontSize: 13, fontWeight: 700, color: "#5b4afd", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" },
  mainHint: { fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#1a1a2e" },
  subHint: { fontSize: 15, color: "#666" },
  faceLostBox: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "popIn 0.25s ease" },
  faceLostTitle: { fontSize: 20, fontWeight: 800, color: "#e1574c", margin: "0 0 6px" },

  
  btnCapture: {
    marginTop: 18,
    width: "100%",
    maxWidth: 280,
    padding: "14px",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  btnCaptureActive: {
    background: "#10b981",
    color: "#fff",
    boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
  },
  btnCaptureDisabled: {
    background: "#e5e7eb",
    color: "#9ca3af",
    cursor: "not-allowed",
    boxShadow: "none",
  },

  footer: { padding: "20px", textAlign: "center" },
  btnFinish: { width: "100%", maxWidth: 300, background: "#5b4afd", color: "#fff", border: "none", padding: "14px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(91,74,253,0.2)" },
  btnResetLink: { background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", textDecoration: "underline" },
};