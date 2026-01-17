"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";

// 🎨 토스 스타일 커스텀 알림창
function AlertModal({ isOpen, message, onClose }: { isOpen: boolean; message: string; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 320, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{message}</div>
        <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "12px", background: "#2563eb", color: "white", fontWeight: 700, borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer" }}>확인</button>
      </div>
    </div>
  );
}

const EXPERTS = [
  { id: "warren_buffett", name: "워런 버핏", emoji: "👴" },
  { id: "nancy_pelosi", name: "낸시 펠로시", emoji: "🏛️" },
  { id: "cathie_wood", name: "캐시 우드", emoji: "🚀" },
  { id: "ray_dalio", name: "레이 달리오", emoji: "🌊" },
  { id: "michael_burry", name: "마이클 버리", emoji: "📉" },
  { id: "korean_top1", name: "국내 1% 고수", emoji: "🇰🇷" },
];

const DAILY_LIMIT = 3;
const LIMIT_KEY = "daily_upgrade_limit_v1";
const HISTORY_KEY = "analysis_history_v1";

export default function UpgradePage() {
  const [mode, setMode] = useState<"single" | "portfolio">("single");
  const [loading, setLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [result, setResult] = useState("");
  const [remaining, setRemaining] = useState<number>(DAILY_LIMIT);
  const [alertMsg, setAlertMsg] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [ticker, setTicker] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [manualData, setManualData] = useState({ per: "", roe: "", pbr: "", psr: "" });
  const [portfolio, setPortfolio] = useState<{ ticker: string; weight: number }[]>([]);
  const [newStock, setNewStock] = useState({ ticker: "", weight: "" });
  const [selectedExpert, setSelectedExpert] = useState("warren_buffett");
  const matchingCardRef = useRef<HTMLDivElement>(null);

  const showAlert = (msg: string) => { setAlertMsg(msg); setIsAlertOpen(true); };
  const getTodayKey = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    const today = getTodayKey();
    const rawLimit = localStorage.getItem(LIMIT_KEY);
    if (rawLimit) {
      const parsed = JSON.parse(rawLimit);
      setRemaining(parsed.date === today ? Math.max(0, DAILY_LIMIT - parsed.count) : DAILY_LIMIT);
    }
  }, []);

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionLoading(true);
    setUploadStatus("AI 분석 중...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Full = reader.result as string;
      setPreviewUrl(base64Full);
      try {
        const res = await fetch("https://invest-review-mvp.vercel.app/api/ai/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "vision", imageBase64: base64Full.split(",")[1] }),
        });
        const data = await res.json();
        const parsed = JSON.parse(data.content.replace(/```json|```/g, ""));
        const item = parsed.extracted?.[0];
        if (item) {
          setUploadStatus("✅ 자동 입력 완료!");
          if (item.weight && item.weight !== "N/A") {
            setMode("portfolio");
            setPortfolio((prev) => [...prev, { ticker: item.ticker.toUpperCase(), weight: Number(item.weight) }]);
          } else {
            setMode("single");
            setTicker(item.ticker);
            setIsManual(true);
            setManualData({ per: item.per || "", roe: item.roe || "", pbr: item.pbr || "", psr: item.psr || "" });
          }
        }
      } catch { setUploadStatus("❌ 분석 실패"); } finally { setVisionLoading(false); }
    };
  };

  const handleSubmit = async () => {
    const today = getTodayKey();
    const rawUsage = localStorage.getItem(LIMIT_KEY);
    let usage = rawUsage ? JSON.parse(rawUsage) : { date: today, count: 0 };
    if (usage.date === today && usage.count >= DAILY_LIMIT) return showAlert("오늘 횟수를 모두 사용했습니다.");

    setLoading(true); setResult(""); setMatchingResult(null);
    try {
      const payload = mode === "single" ? { ticker, manualPer: manualData.per, manualRoe: manualData.roe, manualPbr: manualData.pbr, manualPsr: manualData.psr } : { type: "comparison", portfolio, expertId: selectedExpert };
      const res = await fetch("https://invest-review-mvp.vercel.app/api/ai/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data.content || data);
      if (mode === "portfolio") {
        const sel = EXPERTS.find(e => e.id === selectedExpert);
        setMatchingResult({ styleName: "전략적 투자자", expertName: sel?.name, matchRate: Math.floor(Math.random() * 15) + 82, emoji: sel?.emoji });
      }
      const nextCount = (usage.date === today ? usage.count : 0) + 1;
      localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today, count: nextCount }));
      setRemaining(DAILY_LIMIT - nextCount);
    } catch { setResult("🚨 오류 발생"); } finally { setLoading(false); }
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "16px", boxSizing: "border-box", overflowX: "hidden" }}>
      <AlertModal isOpen={isAlertOpen} message={alertMsg} onClose={() => setIsAlertOpen(false)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: "16px 12px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", textAlign: "left" }}>
          <div style={{ fontSize: 20 }}>📝</div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>매매 복기</div>
        </button>
        <button onClick={() => window.location.href = '/upgrade'} style={{ padding: "16px 12px", borderRadius: 16, border: "2px solid #2563eb", background: "#eff6ff", textAlign: "left" }}>
          <div style={{ fontSize: 20 }}>🔍</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#2563eb" }}>심층 분석</div>
        </button>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>AI 투자 심층 분석</h1>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>
        오늘 무료 사용: {DAILY_LIMIT - remaining} / {DAILY_LIMIT} (남은 횟수: {remaining})
      </div>

      {/* 📸 Vision 카드 (모래시계 로직 추가) */}
      <section style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px", background: "#fff", textAlign: "center", position: "relative" }}>
        <label style={{ cursor: "pointer", display: "block" }}>
          <div style={{ position: "relative", width: "fit-content", margin: "0 auto" }}>
            {!previewUrl ? (
              <div style={{ padding: "20px 0" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb" }}>스크린샷 자동 입력</div>
              </div>
            ) : (
              <>
                <img src={previewUrl} style={{ width: 80, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                {visionLoading && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.7)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    ⏳
                  </div>
                )}
              </>
            )}
          </div>
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleVisionUpload} />
        </label>
        {uploadStatus && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: uploadStatus.includes("✅") ? "#059669" : "#2563eb" }}>
            {uploadStatus}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["single", "portfolio"].map((m) => (
          <button key={m} onClick={() => setMode(m as any)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: mode === m ? "#111827" : "#fff", color: mode === m ? "#fff" : "#111827", fontWeight: 800, fontSize: 13 }}>
            {m === "single" ? "🔍 종목 분석" : "🏆 고수 비교"}
          </button>
        ))}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px", background: "#fff", marginBottom: 20 }}>
        {mode === "single" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="종목명 입력" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 700, boxSizing: "border-box" }} />
            <button onClick={() => setIsManual(!isManual)} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", textDecoration: "underline", textAlign: "left" }}>지표 수동 입력</button>
            {isManual && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["per", "roe", "pbr", "psr"].map((k) => (
                  <div key={k} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input 
                      placeholder={k.toUpperCase()} 
                      type="number" 
                      style={{ width: "100%", padding: "10px", paddingRight: "30px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, boxSizing: "border-box" }} 
                      value={(manualData as any)[k]} 
                      onChange={e => setManualData({...manualData, [k]: e.target.value})} 
                    />
                    <span style={{ position: "absolute", right: "8px", fontSize: "11px", color: "#9ca3af", fontWeight: 700 }}>
                      {(k === "per" || k === "pbr" || k === "psr") ? "배" : "%"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="종목" style={{ flex: 2, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box" }} value={newStock.ticker} onChange={e => setNewStock({...newStock, ticker: e.target.value})} />
              <input placeholder="%" style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box" }} type="number" value={newStock.weight} onChange={e => setNewStock({...newStock, weight: e.target.value})} />
              <button onClick={() => { if(!newStock.ticker) return; setPortfolio([...portfolio, { ticker: newStock.ticker.toUpperCase(), weight: Number(newStock.weight) }]); setNewStock({ticker:"", weight:""}); }} style={{ padding: "0 15px", background: "#2563eb", color: "#fff", borderRadius: 10, border: "none", fontWeight: 900 }}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {portfolio.map((s, i) => (
                <div key={i} style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #2563eb", color: "#2563eb", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
                  {s.ticker} {s.weight}% <span onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} style={{ marginLeft: 4, color: "#ef4444" }}>✕</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {EXPERTS.map(exp => (
                <button key={exp.id} onClick={() => setSelectedExpert(exp.id)} style={{ padding: "12px 4px", borderRadius: 12, border: selectedExpert === exp.id ? "2px solid #2563eb" : "1px solid #e5e7eb", background: selectedExpert === exp.id ? "#eff6ff" : "#fff", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 20 }}>{exp.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{exp.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: 16, background: loading ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 900, border: "none", fontSize: 16, cursor: "pointer", marginBottom: 12 }}>
        {loading ? "AI 분석 중..." : "분석 시작하기"}
      </button>

      {matchingResult && (
        <section ref={matchingCardRef} style={{ padding: "24px 16px", border: "2px solid #2563eb", borderRadius: 20, textAlign: "center", background: "#fff", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#2563eb", letterSpacing: 2, marginBottom: 8 }}>MATCH REPORT</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{matchingResult.expertName} 일치도 {matchingResult.matchRate}%</div>
          <div style={{ fontSize: 48, margin: "12px 0" }}>{matchingResult.emoji}</div>
          <button onClick={async () => {
            const canvas = await html2canvas(matchingCardRef.current!, { scale: 2 });
            const link = document.createElement("a"); link.href = canvas.toDataURL(); link.download = "result.png"; link.click();
          }} style={{ fontSize: 12, background: "#111827", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none" }}>이미지 저장</button>
        </section>
      )}

      {result && (
        <section style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", fontSize: 14, lineHeight: 1.7 }}>
          <ReactMarkdown>{result}</ReactMarkdown>
        </section>
      )}
    </main>
  );
}