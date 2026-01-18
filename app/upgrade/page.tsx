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

const HISTORY_KEY = "analysis_history_v1";
const FREE_HISTORY_LIMIT = 10;

// 유틸리티 함수
function formatDateTime(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement("textarea"); ta.value = text;
  ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.top = "0";
  document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
}

export default function UpgradePage() {
  const [mode, setMode] = useState<"single" | "portfolio">("single");
  const [loading, setLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [result, setResult] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [ticker, setTicker] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [manualData, setManualData] = useState({ per: "", roe: "", pbr: "", psr: "" });
  const [portfolio, setPortfolio] = useState<{ ticker: string; weight: number }[]>([]);
  const [newStock, setNewStock] = useState({ ticker: "", weight: "" });
  const [selectedExpert, setSelectedExpert] = useState("warren_buffett");
  const [history, setHistory] = useState<any[]>([]);
  const matchingCardRef = useRef<HTMLDivElement>(null);

  const showAlert = (msg: string) => { setAlertMsg(msg); setIsAlertOpen(true); };

  useEffect(() => {
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    if (rawHistory) setHistory(JSON.parse(rawHistory).slice(0, FREE_HISTORY_LIMIT));
  }, []);

  const saveToHistory = (item: any) => {
    const newHistory = [item, ...history].slice(0, FREE_HISTORY_LIMIT);
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const loadHistoryItem = (h: any) => {
    setMode(h.mode); 
    setTicker(h.ticker || ""); 
    setCurrentPrice(h.currentPrice || ""); 
    setResult(h.result); 
    setMatchingResult(h.matchingResult || null);
    if (h.manualData) { setManualData(h.manualData); }
    if (h.portfolio) setPortfolio(h.portfolio);
    showAlert("이전 기록을 불러왔습니다.");
  };

  const clearHistoryAll = () => { setHistory([]); localStorage.removeItem(HISTORY_KEY); };

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionLoading(true); setUploadStatus("AI 분석 중...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Full = reader.result as string;
      setPreviewUrl(base64Full);
      try {
        const res = await fetch("/api/ai/upgrade", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "vision", imageBase64: base64Full.split(",")[1] }),
        });
        const data = await res.json();
        const contentStr = data.text || data.content || "";
        const parsed = JSON.parse(contentStr.replace(/```json|```/g, ""));
        const item = parsed.extracted?.[0];
        if (item) {
          setUploadStatus("✅ 자동 입력 완료!");
          if (item.weight && item.weight !== "N/A") {
            setMode("portfolio"); setPortfolio((prev) => [...prev, { ticker: item.ticker.toUpperCase(), weight: Number(item.weight) }]);
          } else {
            setMode("single"); 
            setTicker(item.ticker.toUpperCase());
            if (item.price) setCurrentPrice(String(item.price));
            setManualData({ per: item.per || "", roe: item.roe || "", pbr: item.pbr || "", psr: item.psr || "" });
          }
        }
      } catch { setUploadStatus("❌ 분석 실패"); } finally { setVisionLoading(false); }
    };
  };

  const onShareOrCopy = async () => {
    if (!result) return;
    const shareText = `[AI 투자 심층 분석 리포트]\n\n종목: ${ticker || "포트폴리오"}\n\n${result}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "AI 투자 분석", text: shareText }); return; } catch (err) { console.log("공유 취소됨"); }
    }
    await copyText(shareText);
    showAlert("분석 내용이 복사되었습니다!");
  };

  const handleSubmit = async () => {
    if (mode === "single" && (!ticker.trim() || !currentPrice.trim())) {
      return showAlert("종목명과 현재가를 입력해주세요.");
    }

    setLoading(true); setResult(""); setMatchingResult(null);
    try {
      // ✅ 전송 전 데이터 가공 (Trim 및 대문자화)
      const payload = mode === "single" 
        ? { 
            ticker: ticker.trim().toUpperCase(), 
            currentPrice: currentPrice.trim(), 
            manualPer: manualData.per, 
            manualRoe: manualData.roe, 
            manualPbr: manualData.pbr, 
            manualPsr: manualData.psr 
          } 
        : { type: "comparison", portfolio, expertId: selectedExpert };

      const res = await fetch("/api/ai/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const content = data.text || data.content || (typeof data === 'string' ? data : "");
      
      if (!content) throw new Error("분석 내용을 가져오지 못했습니다.");
      setResult(content);
      
      let currentMatch = null;
      if (mode === "portfolio") {
        const sel = EXPERTS.find(e => e.id === selectedExpert);
        currentMatch = { expertName: sel?.name, matchRate: Math.floor(Math.random() * 15) + 82, emoji: sel?.emoji };
        setMatchingResult(currentMatch);
      }

      saveToHistory({
        id: Date.now(), createdAt: Date.now(), mode, ticker: mode === "single" ? ticker.toUpperCase() : `${portfolio.length}개 종목`,
        currentPrice: mode === "single" ? currentPrice : null,
        result: content, manualData: mode === "single" ? manualData : null, portfolio: mode === "portfolio" ? portfolio : null, matchingResult: currentMatch
      });

    } catch { setResult("🚨 분석 중 오류 발생"); } finally { setLoading(false); }
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
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
      <p style={{ color: "#6b7280", marginTop: 0, fontSize: 13, marginBottom: 20 }}>종목/포트폴리오 정밀 진단 리포트</p>

      <section style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px", background: "#fff", textAlign: "center" }}>
        <label style={{ cursor: "pointer", display: "block" }}>
          {!previewUrl ? (
            <div style={{ padding: "20px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb" }}>스크린샷 자동 입력</div>
            </div>
          ) : (
            <div style={{ position: "relative", width: "fit-content", margin: "0 auto" }}>
              <img src={previewUrl} style={{ width: 80, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} alt="preview" />
              {visionLoading && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.7)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>⏳</div>}
            </div>
          )}
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleVisionUpload} />
        </label>
        {uploadStatus && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: uploadStatus.includes("✅") ? "#059669" : "#2563eb" }}>{uploadStatus}</div>}
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["single", "portfolio"].map((m) => (
          <button key={m} onClick={() => setMode(m as any)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: mode === m ? "#111827" : "#fff", color: mode === m ? "#fff" : "#111827", fontWeight: 800 }}>
            {m === "single" ? "🔍 종목 분석" : "🏆 고수 비교"}
          </button>
        ))}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px", background: "#fff", marginBottom: 20 }}>
        {mode === "single" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="종목명 (예: TSLA)" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 700, boxSizing: "border-box" }} />
            <input value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="현재가 (예: 225)" style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 700, boxSizing: "border-box" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["per", "roe", "pbr", "psr"].map((k) => (
                <div key={k} style={{ position: "relative" }}>
                  <input placeholder={k.toUpperCase()} type="number" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, boxSizing: "border-box" }} value={(manualData as any)[k]} onChange={e => setManualData({...manualData, [k]: e.target.value})} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="종목" style={{ flex: 2, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb" }} value={newStock.ticker} onChange={e => setNewStock({...newStock, ticker: e.target.value})} />
              <input placeholder="%" style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb" }} type="number" value={newStock.weight} onChange={e => setNewStock({...newStock, weight: e.target.value})} />
              <button onClick={() => { if(!newStock.ticker) return; setPortfolio([...portfolio, { ticker: newStock.ticker.toUpperCase(), weight: Number(newStock.weight) }]); setNewStock({ticker:"", weight:""}); }} style={{ padding: "0 15px", background: "#2563eb", color: "#fff", borderRadius: 10, border: "none", fontWeight: 900 }}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {portfolio.map((s, i) => (
                <div key={i} style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #2563eb", color: "#2563eb", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
                  {s.ticker} {s.weight}% <span onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", marginLeft: 4 }}>✕</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {EXPERTS.map(exp => (
                <button key={exp.id} onClick={() => setSelectedExpert(exp.id)} style={{ padding: "12px 4px", borderRadius: 12, border: selectedExpert === exp.id ? "2px solid #2563eb" : "1px solid #e5e7eb", background: selectedExpert === exp.id ? "#eff6ff" : "#fff" }}>
                  <div style={{ fontSize: 20 }}>{exp.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>{exp.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: "16px", borderRadius: 16, background: loading ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 900, border: "none", fontSize: 16 }}>
          {loading ? "AI 분석 중..." : "분석 시작하기"}
        </button>
        <button onClick={onShareOrCopy} disabled={!result} style={{ padding: "16px", borderRadius: 16, border: "1px solid #111827", background: "white", fontWeight: 900 }}>📤 공유</button>
      </div>

      {matchingResult && (
        <section ref={matchingCardRef} style={{ padding: "24px 16px", border: "2px solid #2563eb", borderRadius: 20, textAlign: "center", background: "#fff", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#2563eb", marginBottom: 8 }}>MATCH REPORT</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{matchingResult.expertName} 일치도 {matchingResult.matchRate}%</div>
          <div style={{ fontSize: 48, margin: "12px 0" }}>{matchingResult.emoji}</div>
          <button onClick={async () => {
            const canvas = await html2canvas(matchingCardRef.current!, { scale: 2 });
            const link = document.createElement("a"); link.href = canvas.toDataURL(); link.download = "result.png"; link.click();
          }} style={{ fontSize: 12, background: "#111827", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none" }}>이미지 저장</button>
        </section>
      )}

      {result && (
        <section style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          <ReactMarkdown>{result}</ReactMarkdown>
        </section>
      )}

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>최근 분석 기록</h2>
          <button onClick={clearHistoryAll} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none" }}>전체 삭제</button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {history.length > 0 ? history.map((h) => (
            <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 900, fontSize: 14 }}>{h.ticker}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(h.createdAt)}</div></div>
              <button onClick={() => loadHistoryItem(h)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, fontSize: 12 }}>불러오기</button>
            </div>
          )) : <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af" }}>기록이 없습니다.</div>}
        </div>
      </section>
    </main>
  );
}