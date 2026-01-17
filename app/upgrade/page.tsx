"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";

// 🏆 고수 라인업 데이터
const EXPERTS = [
  { id: "warren_buffett", name: "워런 버핏", emoji: "👴", desc: "가치투자" },
  { id: "nancy_pelosi", name: "낸시 펠로시", emoji: "🏛️", desc: "정책/빅테크" },
  { id: "cathie_wood", name: "캐시 우드", emoji: "🚀", desc: "혁신성장" },
  { id: "ray_dalio", name: "레이 달리오", emoji: "🌊", desc: "올웨더" },
  { id: "michael_burry", name: "마이클 버리", emoji: "📉", desc: "역발상" },
  { id: "korean_top1", name: "국내 1% 고수", emoji: "🇰🇷", desc: "한국주도주" },
];

const DAILY_LIMIT = 3;
const LIMIT_KEY = "daily_upgrade_limit_v1";
const HISTORY_KEY = "analysis_history_v1";

export default function UpgradePage() {
  const [mode, setMode] = useState<"single" | "portfolio">("single");
  const [loading, setLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false); 
  const [imgLoading, setImgLoading] = useState(false);
  const [result, setResult] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>(""); 

  const [matchingResult, setMatchingResult] = useState<{
    styleName: string; expertName: string; matchRate: number; emoji: string;
  } | null>(null);

  const [ticker, setTicker] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [manualData, setManualData] = useState({ per: "", roe: "", pbr: "", psr: "" });

  const [portfolio, setPortfolio] = useState<{ ticker: string; weight: number }[]>([]);
  const [newStock, setNewStock] = useState({ ticker: "", weight: "" });
  const [selectedExpert, setSelectedExpert] = useState("warren_buffett");

  const [history, setHistory] = useState<any[]>([]);
  const matchingCardRef = useRef<HTMLDivElement>(null);

  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    const today = getTodayKey();
    const rawLimit = localStorage.getItem(LIMIT_KEY);
    if (rawLimit) {
      const parsed = JSON.parse(rawLimit);
      setRemaining(parsed.date === today ? Math.max(0, DAILY_LIMIT - parsed.count) : DAILY_LIMIT);
    } else {
      setRemaining(DAILY_LIMIT);
    }
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    if (rawHistory) setHistory(JSON.parse(rawHistory));
  }, []);

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionLoading(true);
    setUploadStatus("이미지 분석 중...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Full = reader.result as string;
      setPreviewUrl(base64Full); 
      const base64Data = base64Full.split(",")[1];
      try {
        const res = await fetch("https://invest-review-mvp.vercel.app/api/ai/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "vision", imageBase64: base64Data }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const parsed = JSON.parse(data.content.replace(/```json|```/g, ""));
        const item = parsed.extracted?.[0];
        if (item) {
          setUploadStatus("✅ 분석 성공!");
          if (item.weight && item.weight !== "N/A") {
            setMode("portfolio");
            setPortfolio((prev) => [...prev, { ticker: item.ticker.toUpperCase(), weight: Number(item.weight) }]);
          } else {
            setMode("single"); setTicker(item.ticker); setIsManual(true); 
            setManualData({
              per: item.per !== "N/A" ? item.per : "",
              roe: item.roe !== "N/A" ? item.roe : "",
              pbr: item.pbr !== "N/A" ? item.pbr : "",
              psr: item.psr !== "N/A" ? item.psr : "",
            });
          }
        }
      } catch (err) { setUploadStatus("❌ 분석 실패. 직접 입력해 주세요."); } 
      finally { setVisionLoading(false); }
    };
  };

  const saveToHistory = (tickerName: string, content: string) => {
    const newItem = { id: Date.now(), ticker: tickerName, content: content, date: new Date().toLocaleString(), mode: mode };
    const nextHistory = [newItem, ...history].slice(0, 10);
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const handleDownloadCard = async () => {
    if (!matchingCardRef.current) return;
    setImgLoading(true);
    try {
      const canvas = await html2canvas(matchingCardRef.current, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image; link.download = `Analysis_${getTodayKey()}.png`; link.click();
    } catch (err) { alert("이미지 저장 실패"); } finally { setImgLoading(false); }
  };

  const onShareOrCopy = async () => {
    if (!result) return;
    const shareText = `[AI 투자 분석 리포트]\n\n${result}`;
    if (navigator.share) {
      try { await navigator.share({ title: `AI 분석 결과`, text: shareText }); return; } catch (err) {}
    }
    try { await navigator.clipboard.writeText(shareText); alert("내용이 복사되었습니다!"); } catch { alert("복사 실패"); }
  };

  const addStock = () => {
    if (!newStock.ticker || !newStock.weight) return alert("종목과 비중을 입력하세요!");
    setPortfolio([...portfolio, { ticker: newStock.ticker.toUpperCase(), weight: Number(newStock.weight) }]);
    setNewStock({ ticker: "", weight: "" });
  };

  const handleSubmit = async () => {
    const today = getTodayKey();
    const rawUsage = localStorage.getItem(LIMIT_KEY);
    let currentUsage = rawUsage ? JSON.parse(rawUsage) : { date: today, count: 0 };
    if (currentUsage.date === today && currentUsage.count >= DAILY_LIMIT) { alert("오늘 무료 분석 횟수를 모두 사용하셨습니다."); return; }
    setLoading(true); setResult(""); setMatchingResult(null);
    try {
      const payload = mode === "single" ? { ticker, manualPer: isManual ? manualData.per : null, manualRoe: isManual ? manualData.roe : null, manualPbr: isManual ? manualData.pbr : null, manualPsr: isManual ? manualData.psr : null } : { type: "comparison", portfolio, expertId: selectedExpert };
      const res = await fetch("https://invest-review-mvp.vercel.app/api/ai/upgrade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json(); if (data.error) throw new Error(data.error);
      const finalContent = data.content || data; setResult(finalContent); 
      if (mode === "portfolio") {
        const selected = EXPERTS.find(e => e.id === selectedExpert);
        setMatchingResult({ styleName: "전략적 가치 투자자", expertName: selected?.name || "", matchRate: Math.floor(Math.random() * 15) + 82, emoji: selected?.emoji || "💰" });
      }
      saveToHistory(mode === "single" ? ticker.toUpperCase() : "포트폴리오 분석", finalContent);
      const nextCount = (currentUsage.date === today ? currentUsage.count : 0) + 1;
      localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today, count: nextCount }));
      setRemaining(DAILY_LIMIT - nextCount);
    } catch (error: any) { setResult("🚨 분석 오류가 발생했습니다."); } finally { setLoading(false); }
  };

  return (
    <main style={{ 
      maxWidth: 920, 
      margin: "24px auto", 
      padding: "16px", 
      boxSizing: "border-box", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      color: "#111827", 
      minHeight: "100vh", 
      overflowX: "hidden" 
    }}>
      
      {/* 🚀 서비스 스위처 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 30 }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: "20px 16px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#ffffff", cursor: "pointer", textAlign: "left", boxSizing: "border-box" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>매매 복기</div>
        </button>
        <button onClick={() => window.location.href = '/upgrade'} style={{ padding: "20px 16px", borderRadius: 16, border: "2px solid #2563eb", background: "#eff6ff", cursor: "pointer", textAlign: "left", boxSizing: "border-box" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#2563eb" }}>심층 분석</div>
        </button>
      </div>

      <div style={{ boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}> AI 투자 심층 분석 </h1>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>오늘 남은 횟수: {remaining ?? 3}회</div>
      </div>

      {/* 📸 Vision 카드 */}
      <section style={{ marginBottom: 24, border: "1px solid #e5e7eb", borderRadius: 16, padding: "24px 12px", background: "#ffffff", textAlign: "center", boxSizing: "border-box" }}>
        <label style={{ cursor: "pointer", display: "block" }}>
          {!previewUrl ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{visionLoading ? "⏳" : "📸"}</div>
              <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 18 }}>사진 업로드 및 자동 입력</div>
            </>
          ) : (
            <div style={{ position: "relative", width: "100px", height: "130px", margin: "0 auto 12px", borderRadius: 12, overflow: "hidden", border: "2px solid #2563eb" }}>
              <img src={previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Preview" />
              {visionLoading && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⏳</div>}
            </div>
          )}
          {uploadStatus && <div style={{ marginTop: 12, fontWeight: 800, color: "#2563eb", fontSize: 14 }}>{uploadStatus}</div>}
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleVisionUpload} disabled={visionLoading} />
        </label>
      </section>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button onClick={() => { setMode("single"); setResult(""); }} style={{ flex: 1, padding: "14px", borderRadius: 999, border: "1px solid #e5e7eb", background: mode === "single" ? "#111827" : "white", color: mode === "single" ? "white" : "#111827", fontWeight: 900, fontSize: 14 }}>🔍 종목 분석</button>
        <button onClick={() => { setMode("portfolio"); setResult(""); }} style={{ flex: 1, padding: "14px", borderRadius: 999, border: "1px solid #e5e7eb", background: mode === "portfolio" ? "#111827" : "white", color: mode === "portfolio" ? "white" : "#111827", fontWeight: 900, fontSize: 14 }}>🏆 고수 비교</button>
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 22, background: "white", marginBottom: 24, boxSizing: "border-box" }}>
        {mode === "single" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <label style={{ fontWeight: 800, fontSize: 15 }}>분석할 종목명 또는 티커
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="예: 삼성전자" style={{ width: "100%", padding: 14, marginTop: 10, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} />
            </label>
            <button onClick={() => setIsManual(!isManual)} style={{ fontSize: 13, fontWeight: 900, color: "#6b7280", background: "none", border: "none", textDecoration: "underline", textAlign: "left", cursor: "pointer" }}>
              {isManual ? "✕ 수동 입력 닫기" : "+ 재무 지표 직접 입력 (배, %)"}
            </button>
            {isManual && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { k: "per", l: "PER (배)" },
                  { k: "roe", l: "ROE (%)" },
                  { k: "pbr", l: "PBR (배)" },
                  { k: "psr", l: "PSR (배)" }
                ].map((item) => (
                  <div key={item.k}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>{item.l}</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box", fontWeight: 700 }} value={(manualData as any)[item.k]} onChange={e => setManualData({...manualData, [item.k]: e.target.value})} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24, width: "100%" }}>
            <div style={{ padding: "20px 16px", background: "#f9fafb", borderRadius: 16, border: "1px solid #e5e7eb", boxSizing: "border-box" }}>
              <div style={{ fontWeight: 900, marginBottom: 14, fontSize: 15, color: "#2563eb" }}>나의 포트폴리오</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14, width: "100%", boxSizing: "border-box" }}>
                <input placeholder="종목" style={{ flex: 2, minWidth: 0, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box" }} value={newStock.ticker} onChange={e => setNewStock({...newStock, ticker: e.target.value})} />
                <input placeholder="%" style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box" }} type="number" value={newStock.weight} onChange={e => setNewStock({...newStock, weight: e.target.value})} />
                <button onClick={addStock} style={{ padding: "0 18px", background: "#2563eb", color: "white", borderRadius: 12, border: "none", fontWeight: 900, flexShrink: 0 }}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {portfolio.map((s, i) => (
                  <div key={i} style={{ padding: "8px 14px", background: "white", border: "1.5px solid #2563eb", color: "#2563eb", borderRadius: 99, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", boxSizing: "border-box" }}>
                    {s.ticker} {s.weight}% <span onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} style={{ marginLeft: 6, cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ width: "100%", boxSizing: "border-box" }}>
              <div style={{ fontWeight: 900, marginBottom: 16, fontSize: 15 }}>비교할 투자 고수 선택</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, width: "100%", boxSizing: "border-box" }}>
                {EXPERTS.map(exp => (
                  <button key={exp.id} onClick={() => setSelectedExpert(exp.id)} style={{ padding: "16px 8px", borderRadius: 16, border: selectedExpert === exp.id ? "3px solid #2563eb" : "1px solid #e5e7eb", background: selectedExpert === exp.id ? "#eff6ff" : "white", cursor: "pointer", boxSizing: "border-box", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{exp.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", textAlign: "center" }}>{exp.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 12, boxSizing: "border-box" }}>
        <button onClick={handleSubmit} disabled={loading || (mode === 'single' && !ticker) || (mode === 'portfolio' && portfolio.length === 0)} style={{ padding: "20px", borderRadius: 16, border: "none", background: loading ? "#93c5fd" : "#2563eb", color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.2)" }}>
          {loading ? "AI 정밀 분석 중..." : (mode === "single" ? "종목 심층 분석 시작" : "고수와 비교하기")}
        </button>
        <div style={{ display: "flex", gap: 10, boxSizing: "border-box" }}>
          <button onClick={onShareOrCopy} disabled={!result} style={{ flex: 1, padding: "15px", borderRadius: 14, border: "1.5px solid #111827", background: "white", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>공유/복사 📤</button>
          <button onClick={() => { setResult(""); setTicker(""); setPortfolio([]); setPreviewUrl(null); setUploadStatus(""); setIsManual(false); }} style={{ flex: 1, padding: "15px", borderRadius: 14, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>초기화</button>
        </div>
      </div>

      {matchingResult && (
        <section style={{ marginTop: 40, textAlign: "center", boxSizing: "border-box" }}>
          <div ref={matchingCardRef} style={{ border: "4px solid #2563eb", borderRadius: 24, padding: "40px 20px", boxSizing: "border-box", background: "#ffffff", maxWidth: 480, margin: "0 auto", boxShadow: "0 12px 30px rgba(37, 99, 235, 0.15)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, opacity: 0.05, fontSize: 180 }}>{matchingResult.emoji}</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 28 }}>"{matchingResult.styleName}"</h2>
            <div style={{ background: "#f8faff", borderRadius: 20, padding: "40px 10px", border: "1px solid #e5e7eb", marginBottom: 24 }}>
              <div style={{ fontSize: 80, marginBottom: 15 }}>{matchingResult.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#6b7280" }}>{matchingResult.expertName} 일치도</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: "#2563eb" }}>{matchingResult.matchRate}%</div>
            </div>
          </div>
          <button onClick={handleDownloadCard} disabled={imgLoading} style={{ marginTop: 20, padding: "16px 32px", background: "#111827", color: "white", borderRadius: 16, border: "none", fontWeight: 900, fontSize: 16 }}>📸 결과 저장</button>
        </section>
      )}

      {result && (
        <section style={{ marginTop: 40, border: "1px solid #e5e7eb", borderRadius: 20, padding: 28, background: "white", boxSizing: "border-box" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, marginBottom: 20, color: "#111827", borderBottom: "2.5px solid #f3f4f6", paddingBottom: 15 }}>AI 심층 리포트</h2>
          <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}><ReactMarkdown>{result}</ReactMarkdown></div>
        </section>
      )}

      <section style={{ marginTop: 48, borderTop: "2.5px solid #f3f4f6", paddingTop: 40, boxSizing: "border-box" }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: 22, fontWeight: 900 }}>최근 분석 기록</h2>
        {history.length > 0 ? (
          <div style={{ display: "grid", gap: 14 }}>
            {history.map((h: any) => (
              <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 20, background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: "#111827", fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.ticker}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>{h.date.split(",")[0]}</div>
                </div>
                <button onClick={() => {setResult(h.content); window.scrollTo({top: 0, behavior:'smooth'});}} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid #2563eb", background: "white", color: "#2563eb", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>불러오기</button>
              </div>
            ))}
          </div>
        ) : ( <div style={{ textAlign: "center", padding: 50, color: "#9ca3af" }}>기록이 없습니다.</div> )}
      </section>

      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 50, textAlign: "center", lineHeight: 1.6 }}>* 본 분석 결과는 AI 데이터 기반 투자 참고용입니다.</p>
    </main>
  );
}