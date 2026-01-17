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

  // --- [추가: 업로드 상태 및 미리보기 전용 상태] ---
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>(""); // "읽는 중...", "성공", "실패"

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

  // 📸 [핵심 수정] 스크린샷 분석 함수 (절대경로 + 자동창열기 + 미리보기)
  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVisionLoading(true);
    setUploadStatus("AI가 이미지를 분석 중입니다...");
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Full = reader.result as string;
      setPreviewUrl(base64Full); // 1. 미리보기 즉시 표시
      const base64Data = base64Full.split(",")[1];

      try {
        // 2. [수정] 토스 내부망용 절대 경로 API 호출
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
          setUploadStatus("✅ 성공적으로 데이터를 읽어왔습니다!");
          if (item.weight && item.weight !== "N/A") {
            setMode("portfolio");
            setPortfolio((prev) => [...prev, { ticker: item.ticker.toUpperCase(), weight: Number(item.weight) }]);
          } else {
            setMode("single");
            setTicker(item.ticker);
            // 3. [핵심] 수동 입력창을 자동으로 열어줌
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
      link.download = `My_Investment_Style_${getTodayKey()}.png`;
      link.click();
    } catch (err) {
      alert("이미지 저장 실패");
    } finally {
      setImgLoading(false);
    }
  };

  const onShareOrCopy = async () => {
    if (!result) return;
    const shareText = `[AI 투자 분석 리포트]\n\n${result}`;
    if (navigator.share) {
      try { await navigator.share({ title: `AI 분석 결과`, text: shareText }); return; } 
      catch (err) { console.log("공유 취소"); }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      alert("내용이 복사되었습니다!");
    } catch {
      alert("복사 실패");
    }
  };

  const addStock = () => {
    if (!newStock.ticker || !newStock.weight) return alert("종목과 비중을 입력하세요!");
    setPortfolio([...portfolio, { ticker: newStock.ticker.toUpperCase(), weight: Number(newStock.weight) }]);
    setNewStock({ ticker: "", weight: "" });
  };

  // ✅ [수정] 제출 함수도 토스 빌드용 절대 경로로 변경
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
      
      const historyTitle = mode === "single" ? ticker.toUpperCase() : "포트폴리오 비교 분석";
      saveToHistory(historyTitle, finalContent);

      const nextCount = (currentUsage.date === today ? currentUsage.count : 0) + 1;
      localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today, count: nextCount }));
      setRemaining(DAILY_LIMIT - nextCount);

    } catch (error: any) {
      setResult("🚨 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 920, margin: "24px auto", padding: 16, boxSizing: "border-box", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#111827", minHeight: "100vh", overflowX: "hidden" }}>
      
      {/* 🚀 서비스 선택 메뉴 (토스 프론트 스타일) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 30 }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: "20px 16px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#ffffff", cursor: "pointer", textAlign: "left", transition: "0.2s" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
          <div style={{ fontWeight: 900, color: "#111827", fontSize: 16 }}>매매 복기</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 700 }}>원칙 점검 및 기록</div>
        </button>
        <button onClick={() => window.location.href = '/upgrade'} style={{ padding: "20px 16px", borderRadius: 16, border: "2px solid #2563eb", background: "#eff6ff", cursor: "pointer", textAlign: "left", transition: "0.2s" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 16 }}>심층 분석</div>
          <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 4, fontWeight: 700 }}>스캔 및 고수 비교</div>
        </button>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}> AI 투자 심층 분석 & 고수 비교 </h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>실시간 데이터와 시각 분석 AI를 통해 투자의 원칙을 점검합니다.</p>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>오늘 무료 사용: {DAILY_LIMIT - (remaining ?? 3)} / {DAILY_LIMIT} (남은 횟수: {remaining ?? 3})</div>

      {/* 📸 Vision 카드 섹션: 미리보기 및 상태창 탑재 */}
      <section style={{ marginBottom: 24, border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, background: "#ffffff", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <label style={{ cursor: "pointer", display: "block" }}>
          {!previewUrl ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{visionLoading ? "⏳" : "📸"}</div>
              <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 18 }}>토스나 증권사 앱 사진을 업로드 하세요</div>
              <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8, fontWeight: 700 }}>AI가 정보를 자동 입력합니다.</p>
            </>
          ) : (
            <div style={{ position: "relative", width: "120px", height: "160px", margin: "0 auto", borderRadius: 12, overflow: "hidden", border: "2px solid #2563eb" }}>
              <img src={previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Upload Preview" />
              {visionLoading && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⏳</div>
              )}
            </div>
          )}
          
          {uploadStatus && (
            <div style={{ marginTop: 14, fontWeight: 800, color: uploadStatus.includes("✅") ? "#059669" : uploadStatus.includes("❌") ? "#ef4444" : "#2563eb", fontSize: 14 }}>
              {uploadStatus}
            </div>
          )}

          <div style={{ marginTop: 20, padding: "16px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12 }}>
            <p style={{ fontSize: 13, color: "#9a3412", fontWeight: 900 }}>⚠️ 보안을 위해 계좌번호 등 민감 정보는 가리거나 잘라서 업로드해 주세요.</p>
          </div>
          <input type="file" style={{ display: "none" }} accept="image/*" onChange={handleVisionUpload} disabled={visionLoading} />
        </label>
      </section>

      {/* 탭 스위처 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button onClick={() => { setMode("single"); setResult(""); setMatchingResult(null); }} style={{ flex: 1, padding: "14px", borderRadius: 999, border: "1px solid #e5e7eb", background: mode === "single" ? "#111827" : "white", color: mode === "single" ? "white" : "#111827", fontWeight: 900, cursor: "pointer", transition: "all 0.2s" }}>🔍 종목 심층 분석</button>
        <button onClick={() => { setMode("portfolio"); setResult(""); setMatchingResult(null); }} style={{ flex: 1, padding: "14px", borderRadius: 999, border: "1px solid #e5e7eb", background: mode === "portfolio" ? "#111827" : "white", color: mode === "portfolio" ? "white" : "#111827", fontWeight: 900, cursor: "pointer", transition: "all 0.2s" }}>🏆 고수 포플 비교</button>
      </div>

      {/* 메인 입력 카드 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 22, background: "white", marginBottom: 24, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        {mode === "single" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <label style={{ fontWeight: 800 }}>분석할 종목명 또는 티커
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="예: 삼성전자 / 테슬라 / TSLA" style={{ width: "100%", padding: 14, marginTop: 10, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700, fontSize: 16 }} />
            </label>
            <div>
              <button onClick={() => setIsManual(!isManual)} style={{ fontSize: 13, fontWeight: 900, color: "#6b7280", background: "none", border: "none", padding: "4px 0", cursor: "pointer", textDecoration: "underline" }}>
                {isManual ? "✕ 수동 입력창 닫기" : "+ 재무 지표 직접 입력하기 (선택 사항)"}
              </button>
              {isManual && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase", paddingLeft: 4 }}>PER (배)</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} value={manualData.per} onChange={e => setManualData({...manualData, per: e.target.value})} />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase", paddingLeft: 4 }}>ROE (%)</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} value={manualData.roe} onChange={e => setManualData({...manualData, roe: e.target.value})} />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase", paddingLeft: 4 }}>PBR (배)</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} value={manualData.pbr} onChange={e => setManualData({...manualData, pbr: e.target.value})} />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#9ca3af", textTransform: "uppercase", paddingLeft: 4 }}>PSR (배)</div>
                    <input type="number" placeholder="0.0" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxSizing: "border-box", outline: "none", fontWeight: 700 }} value={manualData.psr} onChange={e => setManualData({...manualData, psr: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ padding: 20, background: "#f9fafb", borderRadius: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 900, marginBottom: 14, fontSize: 15, color: "#2563eb" }}>나의 포트폴리오</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <input placeholder="종목명" style={{ flex: 2, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontWeight: 700 }} value={newStock.ticker} onChange={e => setNewStock({...newStock, ticker: e.target.value})} />
                <input placeholder="비중(%)" style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontWeight: 700 }} type="number" value={newStock.weight} onChange={e => setNewStock({...newStock, weight: e.target.value})} />
                <button onClick={addStock} style={{ padding: "0 28px", background: "#2563eb", color: "white", borderRadius: 12, border: "none", fontWeight: 900, fontSize: 20 }}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {portfolio.map((s, i) => (
                  <div key={i} style={{ padding: "10px 16px", background: "white", border: "1.5px solid #2563eb", color: "#2563eb", borderRadius: 99, fontSize: 13, fontWeight: 800, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 2px 5px rgba(37,99,235,0.1)" }}>
                    {s.ticker} {s.weight}% <span onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 14, fontSize: 15 }}>비교할 투자 고수 선택</div>
              {/* 🎯 수정 포인트: repeat(2, 1fr)로 2열 3행 그리드 적용 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {EXPERTS.map(exp => (
                  <button key={exp.id} onClick={() => setSelectedExpert(exp.id)} style={{ padding: 16, borderRadius: 16, border: selectedExpert === exp.id ? "3px solid #2563eb" : "1px solid #e5e7eb", background: selectedExpert === exp.id ? "#eff6ff" : "white", cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{exp.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{exp.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 실행 버튼 세션 */}
      <div style={{ display: "grid", gap: 12 }}>
        <button onClick={handleSubmit} disabled={loading || (mode === 'single' && !ticker) || (mode === 'portfolio' && portfolio.length === 0)} style={{ padding: "20px", borderRadius: 16, border: "none", background: loading ? "#93c5fd" : "#2563eb", color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.2)", transition: "all 0.2s" }}>
          {loading ? "AI가 정밀 분석 중..." : (mode === "single" ? "실시간 종목 심층 분석 시작" : "고수와 포트폴리오 비교하기")}
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onShareOrCopy} disabled={!result} style={{ flex: 1, padding: "15px", borderRadius: 14, border: "1.5px solid #111827", background: "white", fontWeight: 900, cursor: "pointer", opacity: !result ? 0.5 : 1 }}>결과 공유/복사 📤</button>
          <button onClick={() => { setResult(""); setTicker(""); setPortfolio([]); setMatchingResult(null); setPreviewUrl(null); setUploadStatus(""); }} style={{ flex: 1, padding: "15px", borderRadius: 14, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>입력 초기화</button>
        </div>
      </div>

      {/* 🏆 Match Card */}
      {matchingResult && (
        <section style={{ marginTop: 40, textAlign: "center" }}>
          <div ref={matchingCardRef} style={{ border: "4px solid #2563eb", borderRadius: 24, padding: "36px 20px", boxSizing: "border-box", background: "#ffffff", maxWidth: 480, margin: "0 auto", boxShadow: "0 12px 30px rgba(37, 99, 235, 0.15)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, opacity: 0.05, fontSize: 180, transform: "rotate(15deg)" }}>{matchingResult.emoji}</div>
            <div style={{ fontWeight: 900, color: "#2563eb", fontSize: 13, letterSpacing: 4, marginBottom: 15, textTransform: "uppercase" }}>Investment Style Match</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 28, lineHeight: 1.4 }}>대표님은<br/>"{matchingResult.styleName}"</h2>
            <div style={{ background: "#f8faff", borderRadius: 20, padding: "44px 20px", border: "1px solid #e5e7eb", marginBottom: 24, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 90, marginBottom: 20, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.1))" }}>{matchingResult.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#6b7280" }}>{matchingResult.expertName} 일치도</div>
              <div style={{ fontSize: 72, fontWeight: 900, color: "#2563eb", letterSpacing: "-3px" }}>{matchingResult.matchRate}%</div>
            </div>
            <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>Analyzed by AI 투자 복기 & 매매 규칙 체크</p>
          </div>
          <button onClick={handleDownloadCard} disabled={imgLoading} style={{ marginTop: 20, padding: "16px 40px", background: "#111827", color: "white", borderRadius: 16, border: "none", fontWeight: 900, cursor: "pointer", fontSize: 16, boxShadow: "0 5px 15px rgba(0,0,0,0.2)" }}>
            📸 {imgLoading ? "이미지 생성 중..." : "매칭 결과 리포트 이미지 저장"}
          </button>
        </section>
      )}

      {/* 분석 결과 리포트 */}
      {result && (
        <section style={{ marginTop: 40, border: "1px solid #e5e7eb", borderRadius: 20, padding: 28, background: "white", boxShadow: "0 2px 15px rgba(0,0,0,0.04)" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, marginBottom: 20, color: "#111827", borderBottom: "2.5px solid #f3f4f6", paddingBottom: 15 }}>AI 심층 분석 리포트</h2>
          <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* 히스토리 섹션 */}
      <section style={{ marginTop: 48, borderTop: "2.5px solid #f3f4f6", paddingTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>최근 분석 기록</h2>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#9ca3af", background: "#f3f4f6", padding: "4px 12px", borderRadius: 99 }}>최근 10개</span>
        </div>
        {history.length > 0 ? (
          <div style={{ display: "grid", gap: 14 }}>
            {history.map((h: any) => (
              <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 20, background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "transform 0.2s" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#111827", fontSize: 18, marginBottom: 4 }}>{h.ticker}</div>
                  <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>{h.date} · {h.mode === 'single' ? '종목분석' : '고수비교'}</div>
                </div>
                <button onClick={() => {setResult(h.content); setTicker(h.ticker); setMode(h.mode || 'single'); window.scrollTo({top: 0, behavior:'smooth'});}} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #2563eb", background: "white", color: "#2563eb", fontWeight: 900, cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}>불러오기</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", border: "2px dashed #d1d5db", borderRadius: 20, padding: 50 }}>
            <p style={{ color: "#9ca3af", fontSize: 15, fontWeight: 700 }}>아직 분석 기록이 없습니다.</p>
          </div>
        )}
      </section>

      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 50, textAlign: "center", lineHeight: 1.6 }}>* 본 분석 결과는 AI 데이터 기반 투자 참고용이며,<br/>모든 투자의 최종 책임은 본인에게 있습니다.</p>
    </main>
  );
}