"use client";

import { useMemo, useRef, useState, useEffect } from "react";

type TradeType = "long" | "swing" | "day";

const TAB_LABEL: Record<TradeType, string> = {
  long: "장기 투자",
  swing: "스윙",
  day: "단타",
};

const NOTE_TEMPLATES: Record<TradeType, string> = {
  long: `아래 질문에 답하듯 자세히 적어주세요. (장기/가치투자)

1) 기업/산업 이해: 이 회사를 왜 믿나? 제품/경쟁우위(해자)는?
2) 밸류에이션: PER/PBR/PS(대략이라도)와 “싸다고 판단한 근거”
3) 재무/안정성: 부채비율/현금흐름/이자보상배율 등 리스크 체크
4) 매수 논리(Thesis): 2~3년 관점에서 기대 시나리오
5) Thesis break(손절 기준): 어떤 일이 생기면 생각을 바꿀 건지(숫자/조건)
6) 분할매수/추가매수 계획: 어떤 가격/조건에서 얼마를 더 살지`,

  swing: `아래 질문에 답하듯 자세히 적어주세요. (스윙)

1) 트리거: 어디서 무엇(패턴/뉴스/수급) 보고 들어감?
2) 진입 기준: 지지/저항/추세/거래량 중 무엇이 핵심?
3) 손절 기준: ‘가격/조건’으로 명확히 (예: 지지 이탈 or -3%)
4) 익절/분할익절: 목표가/구간, 손익비(RR) 계산
5) 보유 기간/이벤트 리스크: 실적/발표/매크로 변수 체크했나?
6) 대안: 같은 자금이면 더 좋은 자리/종목이 있었나?`,

  day: `아래 질문에 답하듯 자세히 적어주세요. (단타)

1) 진입 근거: 체결강도/거래량/호가/모멘텀 등 ‘딱 한 문장’ 요약
2) 손절 규칙: 즉시 손절 조건(틱/퍼센트/레벨) + 최대 손실 한도
3) 익절 규칙: 목표 구간/분할익절/트레일링 여부
4) 실행 점검: 계획대로 했나? (늦진입/추격/충동 진입 여부)
5) 과매매/멘탈: 조급/복수매매 신호 있었나?
6) 다음 액션: 다음엔 뭐 하나만 바꿀 건지(1개만)`,
};

// ✅ “옆에 볼 수 있는 예시” (탭별)
const EXAMPLE_NOTES: Record<TradeType, string> = {
  long: `예시(장기):
- 산업/해자: 2위 사업자지만 단가/브랜드로 재구매율 높음
- 밸류: PER 14, PBR 1.6 수준 → 과거 밴드 하단이라 판단
- 재무: 부채비율 80%, FCF 흑자 유지
- Thesis: 2년 내 신제품+해외 확장으로 매출 CAGR 15% 기대
- Break: FCF 2분기 연속 적자 or 핵심 시장 점유율 -3%p`,
  swing: `예시(스윙):
- 트리거: 20일선 지지 + 거래량 2배 + 저항(52,000) 돌파 시도
- 진입: 52,200 돌파 확인 후 1/2 진입
- 손절: 51,200 이탈 시 전량(-2.0%)
- 익절: 54,000 1차, 56,000 2차 / RR 약 1:2
- 이벤트: 내일 CPI 발표 → 포지션 사이즈 50%로 제한`,
  day: `예시(단타):
- 근거: 장 시작 10분 고가 돌파 + 체결강도 180% + 호가 얇음
- 손절: 진입가 -0.7% 또는 직전 저점 이탈 즉시 컷
- 익절: +1.2% 1차, +2.0% 2차 / 트레일링 0.5%
- 금지: 재진입 1회까지만, 복수매매 금지
- 체크: 수수료/슬리피지 포함 손익 확인`,
};

function clampTicker(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ====== ✅ 히스토리(오프라인 저장) ======
const HISTORY_KEY = "invest_review_history_v1";
const FREE_HISTORY_LIMIT = 10;

type HistoryItem = {
  id: string;
  createdAt: number;
  tradeType: TradeType;
  ticker: string;
  entryPrice: number;
  stopLoss: number | null;
  reasonNote: string;
  result: string;
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function short(s: string, n = 80) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// ====== ✅ 내보내기(복사) ======
function buildExportText(h: HistoryItem) {
  const label = TAB_LABEL[h.tradeType];
  const created = formatDateTime(h.createdAt);
  const sl = h.stopLoss == null ? "N/A" : String(h.stopLoss);

  return [
    `AI 투자 복기 리포트`,
    `- 날짜: ${created}`,
    `- 타입: ${label}`,
    `- 종목: ${h.ticker}`,
    `- 진입가: ${h.entryPrice}`,
    `- 손절가: ${sl}`,
    ``,
    `【메모】`,
    h.reasonNote?.trim() ? h.reasonNote.trim() : "(없음)",
    ``,
    `【AI 결과】`,
    h.result?.trim() ? h.result.trim() : "(없음)",
  ].join("\n");
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function Page() {
  const [tradeType, setTradeType] = useState<TradeType>("long");

  const [ticker, setTicker] = useState("AAPL");
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [reasonNote, setReasonNote] = useState<string>("");

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ✅ 히스토리 state
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ✅ 최초 1회: localStorage 로드
  useEffect(() => {
    const list = safeJsonParse<HistoryItem[]>(
      typeof window !== "undefined" ? localStorage.getItem(HISTORY_KEY) : null,
      []
    );
    const normalized = [...list]
      .filter((x) => x && x.id && x.createdAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FREE_HISTORY_LIMIT);

    setHistory(normalized);
    if (typeof window !== "undefined") {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
    }
  }, []);

  function persistHistory(next: HistoryItem[]) {
    const trimmed = next
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FREE_HISTORY_LIMIT);
    setHistory(trimmed);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }

  function saveToHistory(payload: Omit<HistoryItem, "id" | "createdAt">) {
    const item: HistoryItem = {
      id:
        // @ts-ignore
        crypto?.randomUUID?.() ??
        String(Date.now()) + Math.random().toString(16).slice(2),
      createdAt: Date.now(),
      ...payload,
    };
    persistHistory([item, ...history]);
  }

  function removeHistory(id: string) {
    persistHistory(history.filter((h) => h.id !== id));
  }

  function clearHistoryAll() {
    persistHistory([]);
  }

  // ✅ 내보내기(복사)
  async function exportHistoryItem(h: HistoryItem) {
    const text = buildExportText(h);

    try {
      await copyText(text);
      alert("복기 텍스트를 복사했어! (붙여넣기 하면 돼)");
    } catch {
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (w) {
        w.document.write(
          `<pre style="white-space:pre-wrap;font-family:system-ui;padding:16px">${escapeHtml(
            text
          )}</pre>`
        );
        w.document.close();
      } else {
        prompt("복사해서 사용해줘:", text);
      }
    }
  }

  function loadHistoryItem(h: HistoryItem) {
    setTradeType(h.tradeType);
    setTicker(h.ticker);
    setEntryPrice(h.entryPrice);
    setStopLoss(h.stopLoss ?? "");
    setReasonNote(h.reasonNote);
    setResult(h.result);

    cacheRef.current[h.tradeType] = {
      ticker: h.ticker,
      entryPrice: h.entryPrice,
      stopLoss: h.stopLoss ?? "",
      reasonNote: h.reasonNote,
      result: h.result,
    };
  }

  // ✅ 탭별 입력/결과 저장 (탭 이동해도 유지)
  const cacheRef = useRef<
    Record<
      TradeType,
      {
        ticker: string;
        entryPrice: number;
        stopLoss: number | "";
        reasonNote: string;
        result: string;
      }
    >
  >({
    long: {
      ticker: "AAPL",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
    },
    swing: {
      ticker: "AAPL",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
    },
    day: {
      ticker: "AAPL",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
    },
  });

  // ✅ 탭 변경 시: 이전 탭 저장 → 새 탭 복원
  const prevTradeType = useRef<TradeType>("long");
  useEffect(() => {
    const prev = prevTradeType.current;

    cacheRef.current[prev] = { ticker, entryPrice, stopLoss, reasonNote, result };

    const next = cacheRef.current[tradeType];
    setTicker(next.ticker);
    setEntryPrice(next.entryPrice);
    setStopLoss(next.stopLoss);
    setReasonNote(next.reasonNote);
    setResult(next.result);

    prevTradeType.current = tradeType;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeType]);

  const title = useMemo(() => `AI 투자 복기 리포트 (MVP)`, []);

  async function onGenerate() {
    setLoading(true);
    setResult("AI가 리포트를 작성 중입니다...");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          entryPrice,
          stopLoss: stopLoss === "" ? null : stopLoss,
          reasonNote,
          tradeType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(`서버 에러 (${res.status}): ${data?.text ?? JSON.stringify(data)}`);
        return;
      }

      const text = data?.text ?? "응답에 text가 없습니다.";
      setResult(text);

      // ✅ 생성 성공 시 히스토리에 저장 (최대 10개)
      saveToHistory({
        tradeType,
        ticker,
        entryPrice,
        stopLoss: stopLoss === "" ? null : stopLoss,
        reasonNote,
        result: text,
      });
    } catch (err: any) {
      setResult(`네트워크/실행 오류: ${String(err?.message ?? err)}`);
    } finally {
      setLoading(false);
    }
  }

  function onClearAll() {
    const base = {
      ticker: "AAPL",
      entryPrice: 100,
      stopLoss: "" as const,
      reasonNote: "",
      result: "",
    };

    setTicker(base.ticker);
    setEntryPrice(base.entryPrice);
    setStopLoss(base.stopLoss);
    setReasonNote(base.reasonNote);
    setResult(base.result);

    cacheRef.current[tradeType] = base;
  }

  function onPrintPdfResultOnly() {
    if (!result) return;

    const label = TAB_LABEL[tradeType];
    const docTitle = `AI 투자 복기 리포트 - ${label} - ${ticker}`;
    const stopLossText = stopLoss === "" ? "N/A" : String(stopLoss);

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 10px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
    pre { white-space: pre-wrap; line-height: 1.6; font-size: 13px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(docTitle)}</h1>
  <div class="meta">
    Type: ${escapeHtml(label)}
    / Ticker: ${escapeHtml(ticker)}
    / Entry: ${escapeHtml(String(entryPrice))}
    / StopLoss: ${escapeHtml(stopLossText)}
  </div>
  <pre>${escapeHtml(result)}</pre>
</body>
</html>
`.trim();

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }

  const tabBtn = (key: TradeType) => {
    const active = tradeType === key;
    return (
      <button
        key={key}
        onClick={() => setTradeType(key)}
        style={{
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: active ? "#2563eb" : "white",
          color: active ? "white" : "#111827",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {TAB_LABEL[key]}
      </button>
    );
  };

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "24px auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{title}</h1>

      <p style={{ color: "#6b7280", marginTop: 0 }}>
        장기/스윙/단타 탭으로 분리해서 기록합니다. (무료: 최근 {FREE_HISTORY_LIMIT}개
        오프라인 저장)
      </p>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 10, margin: "14px 0 18px" }}>
        {(["long", "swing", "day"] as TradeType[]).map(tabBtn)}
      </div>

      {/* 입력 카드 */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          background: "white",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ fontWeight: 800 }}>
            종목/티커
            <input
              value={ticker}
              onChange={(e) => setTicker(clampTicker(e.target.value))}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            진입가
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            손절가{" "}
            <span style={{ fontWeight: 600, color: "#6b7280" }}>
              (선택 · 필수 아님)
            </span>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) =>
                setStopLoss(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="예: 92.5 (손절 기준이 없다면 비워두세요)"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            메모(왜 이 매매를 했는지 상세 기록) — {TAB_LABEL[tradeType]}
            <textarea
              value={reasonNote}
              placeholder={NOTE_TEMPLATES[tradeType]}
              onChange={(e) => setReasonNote(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                minHeight: 170,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
          </label>

          {/* ✅ 가이드/예시 카드 */}
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 4,
              padding: 12,
              borderRadius: 12,
              border: "1px dashed #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, color: "#111827" }}>
              {TAB_LABEL[tradeType]} 작성 가이드 & 예시
            </div>

            <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                ✅ 꼭 포함하면 좋은 항목
              </div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {NOTE_TEMPLATES[tradeType]}
              </pre>
            </div>

            <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>📝 예시</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {EXAMPLE_NOTES[tradeType]}
              </pre>
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onGenerate}
              disabled={loading}
              style={{
                flex: 1,
                minWidth: 260,
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "작성 중..." : "AI 복기 리포트 생성"}
            </button>

            <button
              onClick={onPrintPdfResultOnly}
              disabled={!result}
              title={!result ? "먼저 결과를 생성하세요" : "결과만 PDF로 저장"}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "white",
                fontWeight: 900,
                cursor: !result ? "not-allowed" : "pointer",
                opacity: !result ? 0.5 : 1,
              }}
            >
              PDF로 저장(결과만)
            </button>

            <button
              onClick={onClearAll}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              결과/입력 리셋
            </button>
          </div>
        </div>
      </section>

      {/* 결과 */}
      {result && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "white",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>결과</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: 10,
              lineHeight: 1.6,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              color: "#111827",
            }}
          >
            {result}
          </pre>
        </section>
      )}

      {/* ✅ 최근 저장된 복기 */}
      <section
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            최근 저장된 복기 (최대 {FREE_HISTORY_LIMIT}개)
          </h2>

          <button
            onClick={clearHistoryAll}
            disabled={history.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: history.length === 0 ? "not-allowed" : "pointer",
              opacity: history.length === 0 ? 0.5 : 1,
            }}
            title={history.length === 0 ? "저장된 기록이 없습니다" : "전체 삭제"}
          >
            전체 삭제
          </button>
        </div>

        {history.length === 0 ? (
          <p style={{ color: "#6b7280", marginTop: 10 }}>
            아직 저장된 복기가 없습니다. 리포트를 생성하면 자동으로 저장돼요.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#111827" }}>
                    [{TAB_LABEL[h.tradeType]}] {h.ticker} / Entry {h.entryPrice}
                    {h.stopLoss != null ? ` / SL ${h.stopLoss}` : " / SL N/A"}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => loadHistoryItem(h)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="불러오기"
                    >
                      불러오기
                    </button>

                    {/* ✅ 추가: 내보내기(복사) */}
                    <button
                      onClick={() => exportHistoryItem(h)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="텍스트로 내보내기(복사)"
                    >
                      내보내기
                    </button>

                    <button
                      onClick={() => removeHistory(h.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  {formatDateTime(h.createdAt)}
                </div>

                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>메모 요약</div>
                  {short(h.reasonNote || "(메모 없음)", 120)}
                </div>

                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>결과 요약</div>
                  {short(h.result || "(결과 없음)", 140)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>
          * 무료 버전은 기기(브라우저) 내부 저장(localStorage)이라, 브라우저 데이터
          삭제/기기 변경 시 기록이 사라질 수 있어요.
        </p>
      </section>
    </main>
  );
}
