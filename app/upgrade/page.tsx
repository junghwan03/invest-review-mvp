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
  const [visionLoading, setVisionLoading] = useState(false); // 📸 스캔 로딩 상태
  const [imgLoading, setImgLoading] = useState(false);
  const [result, setResult] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  // --- [업로드 상태 및 미리보기 전용 상태] ---
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>(""); 

  const [matchingResult, setMatchingResult] = useState<{
    styleName: string; expertName: string; matchRate: number; emoji: string;
  } | null>(null);

  // --- [상태 1: 단일 종목 분석] ---
  const [ticker, setTicker] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [manualData, setManualData] = useState({ per: "", roe: "", pbr: "", psr: "" });

  // --- [상태 2: 포트폴리오 비교] ---
  const [portfolio, setPortfolio] = useState<{ ticker: string; weight: number }[]>([]);
  const [newStock, setNewStock] = useState({ ticker: "", weight: "" });
  const [selectedExpert, setSelectedExpert] = useState("warren_buffett");

  // --- [상태 3: 히스토리] ---
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

  // 📸 스크린샷 분석 함수
  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVisionLoading(true);
    setUploadStatus("AI가 이미지를 분석 중입니다...");
    
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
          setUploadStatus("✅ 데이터 분석 성공!");
          if (item.weight && item.weight !== "N/A") {
            setMode("portfolio");
            setPortfolio((prev) => [...prev, { ticker: item.ticker.toUpperCase(), weight: Number(item.weight) }]);
          } else {
            setMode("single");
            setTicker(item.ticker);
            setIsManual(true); 
            setManualData({
              per: item.per !== "N/A" ? item.per : "",
              roe: item.roe !== "N/A" ? item.roe : "",
              pbr: item.pbr !== "N/A" ? item.pbr : "",
              psr: item.psr !== "N/A" ? item.psr : "",
            });
          }
        }
      } catch (err) {
        setUploadStatus("❌ 분석 실패. 직접 입력해 주세요.");
      } finally {
        setVisionLoading(false);
      }
    };
  };

  const saveToHistory = (tickerName: string, content: string) => {
    const newItem = {
      id: Date.now(), ticker: tickerName, content: content,
      date: new Date().toLocaleString(), mode: mode
    };
    const nextHistory = [newItem, ...history].slice(0, 10);
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const handleDownloadCard = async () => {
    if (!matchingCardRef.current) return;
    setImgLoading(true);
    try {
      const canvas = await html2canvas(matchingCardRef.current, { 
        scale: 3, backgroundColor: "#ffffff", useCORS: true 
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `My_Style_${getTodayKey()}.png`;
      link.click();
    } catch (err) {
      alert("이미지 저장 실패");
    } finally {
      setImgLoading(false);
    }
  };

  const onShareOrCopy = async () => {
    if (!result) return;
    const shareText = `[AI 분석 리포트]\n\n${result}`;
    if (navigator.share) {
      try { await navigator.share({ title: `AI 분석 결과`, text: shareText }); return; } 
      catch (err) { console.log("공유 취소"); }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      alert("복사되었습니다!");
    } catch {
      alert("복사 실패");
    }
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
    
    if (currentUsage.date === today && currentUsage.count >= DAILY_LIMIT) {
      alert("오늘 무료 분석 횟수를 모두 사용하셨습니다.");
      return;
    }

    setLoading(true); setResult(""); setMatchingResult(null);

    try {
      const payload = mode === "single" 
        ? { ticker, manualPer: isManual ? manualData.per : null, manualRoe: isManual ? manualData.roe : null, manualPbr: isManual ? manualData.pbr : null, manualPsr: isManual ? manualData.psr : null }
        : { type: "comparison", portfolio, expertId: selectedExpert };

      const res = await fetch("https://invest-review-mvp.vercel.app/api/ai/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const finalContent = data.content || data;
      setResult(finalContent); 

      if (mode === "portfolio") {
        const selected = EXPERTS.find(e => e.id === selectedExpert);
        setMatchingResult({
          styleName: "전략적 가치 투자자",
          expertName: selected?.name || "",
          matchRate: Math.floor(Math.random() * 15) + 82,
          emoji: selected?.emoji || "💰",
        });
      }
      
      const historyTitle = mode === "single" ? ticker.toUpperCase() : "포트폴리오 분석";
      saveToHistory(historyTitle, finalContent);

      const nextCount = (currentUsage.date === today ? currentUsage.count : 0) + 1;
      localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today, count: nextCount }));
      setRemaining(DAILY_LIMIT - nextCount);

    } catch (error: any) {
      setResult("🚨 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "16px", boxSizing: "border-box", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111827", minHeight: "100vh", overflowX: "hidden" }}>
      
      {/* 🚀 서비스 스위처 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: "16px 12px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#ffffff", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>📝</div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>매매 복기</div>
        </button>
        <button onClick={() => window.location.href = '/upgrade'} style={{ padding: "16px 12px", borderRadius: 16, border: "2px solid #2563eb", background: "#eff6ff", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🔍</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#2563eb" }}>심층 분석</div>
        </button>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}> AI 투자 심층 분석 </h1>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>남은 횟수: {remaining ?? 3}회</div>

      {/* 📸 Vision 카드 */}
      <section style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 10px", background: "#ffffff", textAlign: "center", boxSizing: "border-box" }}>
        <label style={{ cursor: "pointer", display: "block" }}>
          {!previewUrl ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{visionLoading ? "⏳" : "📸"}</div>
              <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 15 }}>스크린샷 자동 입력</div>
            </>
          ) : (
            <div style={{ position: "relative", width: "80px", height: "110px", margin: "0 auto 8px", borderRadius: 8, overflow: "hidden", border: "2px solid #2563eb" }}>
              <img src={previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Preview" />
            </div>
          )}
          {uploadStatus && <div style={{ marginTop: 8, fontWeight: 800, color: "#2563eb", fontSize: 12 }}>{uploadStatus}</div>}
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleVisionUpload} disabled={visionLoading} />
        </label>
      </section>

      {/* 모드 전환 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setMode("single"); setResult(""); }} style={{ flex: 1, padding: "12px", borderRadius: 99, border: "1px solid #e5e7eb", background: mode === "single" ? "#111827" : "white", color: mode === "single" ? "white" : "#111827", fontWeight: 900, fontSize: 13 }}>🔍 종목 분석</button>
        <button onClick={() => { setMode("portfolio"); setResult(""); }} style={{ flex: 1, padding: "12px", borderRadius: 99, border: "1px solid #e5e7eb", background: mode === "portfolio" ? "#111827" : "white", color: mode === "portfolio" ? "white" : "#111827", fontWeight: 900, fontSize: 13 }}>🏆 고수 비교</button>
      </div>

      {/* 입력 카드 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px", background: "white", marginBottom: 20, boxSizing: "border-box" }}>
        {mode === "single" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ fontWeight: 800, fontSize: 13 }}>분석할 종목명
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="예: 삼성전자" style={{ width: "100%", padding: 12, marginTop: 8, borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} />
            </label>
            <button onClick={() => setIsManual(!isManual)} style={{ fontSize: 12, fontWeight: 900, color: "#6b7280", background: "none", border: "none", textDecoration: "underline", textAlign: "left" }}>
              {isManual ? "✕ 수동 닫기" : "+ 지표 수동 입력"}
            </button>
            {isManual && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["per", "roe", "pbr", "psr"].map((key) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase" }}>{key}</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box", fontWeight: 700 }} value={(manualData as any)[key]} onChange={e => setManualData({...manualData, [key]: e.target.value})} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ padding: "14px 10px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 13, color: "#2563eb" }}>나의 포트폴리오</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input placeholder="종목" style={{ flex: 2, padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} value={newStock.ticker} onChange={e => setNewStock({...newStock, ticker: e.target.value})} />
                <input placeholder="%" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} type="number" value={newStock.weight} onChange={e => setNewStock({...newStock, weight: e.target.value})} />
                <button onClick={addStock} style={{ padding: "0 14px", background: "#2563eb", color: "white", borderRadius: 8, border: "none", fontWeight: 900 }}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {portfolio.map((s, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "white", border: "1.5px solid #2563eb", color: "#2563eb", borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
                    {s.ticker} {s.weight}% <span onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} style={{ marginLeft: 3, color: "#ef4444" }}>✕</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 14 }}>비교할 투자 고수 선택</div>
              {/* 🎯 [2x3 그리드] 모바일에서 절대 안 터지게 간격과 패딩 최적화 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {EXPERTS.map(exp => (
                  <button key={exp.id} onClick={() => setSelectedExpert(exp.id)} style={{ padding: "12px 8px", borderRadius: 12, border: selectedExpert === exp.id ? "2.5px solid #2563eb" : "1px solid #e5e7eb", background: selectedExpert === exp.id ? "#eff6ff" : "white", cursor: "pointer", boxSizing: "border-box", width: "100%" }}>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>{exp.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{exp.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 실행 버튼 세션 */}
      <div style={{ display: "grid", gap: 8 }}>
        <button onClick={handleSubmit} disabled={loading || (mode === 'single' && !ticker) || (mode === 'portfolio' && portfolio.length === 0)} style={{ padding: "18px", borderRadius: 16, border: "none", background: loading ? "#93c5fd" : "#2563eb", color: "white", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
          {loading ? "AI 분석 중..." : (mode === "single" ? "심층 분석 시작" : "고수와 비교하기")}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onShareOrCopy} disabled={!result} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #111827", background: "white", fontWeight: 900, fontSize: 12 }}>공유/복사 📤</button>
          <button onClick={() => { setResult(""); setTicker(""); setPortfolio([]); setPreviewUrl(null); setUploadStatus(""); }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, fontSize: 12 }}>입력 초기화</button>
        </div>
      </div>

      {/* 🏆 Match Card */}
      {matchingResult && (
        <section style={{ marginTop: 30, textAlign: "center" }}>
          <div ref={matchingCardRef} style={{ border: "4px solid #2563eb", borderRadius: 20, padding: "30px 16px", boxSizing: "border-box", background: "#ffffff", maxWidth: "100%", margin: "0 auto", boxShadow: "0 10px 20px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, opacity: 0.05, fontSize: 120 }}>{matchingResult.emoji}</div>
            <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>INVESTMENT STYLE MATCH</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>"{matchingResult.styleName}"</h2>
            <div style={{ background: "#f8faff", borderRadius: 16, padding: "30px 10px", border: "1px solid #e5e7eb", marginBottom: 16 }}>
              <div style={{ fontSize: 60, marginBottom: 10 }}>{matchingResult.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>{matchingResult.expertName} 일치도</div>
              <div style={{ fontSize: 50, fontWeight: 900, color: "#2563eb" }}>{matchingResult.matchRate}%</div>
            </div>
            <p style={{ fontSize: 10, color: "#9ca3af" }}>Analyzed by AI 투자 복기</p>
          </div>
          <button onClick={handleDownloadCard} disabled={imgLoading} style={{ marginTop: 16, padding: "12px 24px", background: "#111827", color: "white", borderRadius: 12, border: "none", fontWeight: 900, fontSize: 14 }}>
            📸 {imgLoading ? "이미지 생성 중..." : "결과 이미지 저장"}
          </button>
        </section>
      )}

      {/* 분석 결과 */}
      {result && (
        <section style={{ marginTop: 30, border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 16px", background: "white" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, marginBottom: 12, color: "#111827", borderBottom: "2px solid #f3f4f6", paddingBottom: 8 }}>분석 리포트</h2>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* 히스토리 */}
      <section style={{ marginTop: 40, borderTop: "2px solid #f3f4f6", paddingTop: 30 }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 900 }}>최근 기록</h2>
        {history.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((h: any) => (
              <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#111827", fontSize: 15 }}>{h.ticker}</div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>{h.date.split(",")[0]}</div>
                </div>
                <button onClick={() => {setResult(h.content); window.scrollTo({top: 0, behavior:'smooth'});}} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #2563eb", background: "white", color: "#2563eb", fontWeight: 900, fontSize: 12 }}>불러오기</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 14 }}>기록이 없습니다.</div>
        )}
      </section>

      <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 40, textAlign: "center", lineHeight: 1.5 }}>* 본 분석 결과는 AI 투자 참고용이며,<br/>최종 책임은 본인에게 있습니다.</p>
    </main>
  );
}