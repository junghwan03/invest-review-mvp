"use client";

import { useState } from "react";

export default function Page() {
  const [ticker, setTicker] = useState("AAPL");
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [reasonNote, setReasonNote] = useState(
    "진입 근거/손절 근거를 짧게 적어주세요."
  );
  const [result, setResult] = useState<string>("");

  async function onGenerate() {
    setResult("AI가 리포트를 작성 중입니다...");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, entryPrice, reasonNote }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(`서버 에러 (${res.status}): ${data?.text ?? JSON.stringify(data)}`);
        return;
      }

      setResult(data?.text ?? "응답에 text가 없습니다.");
    } catch (err: any) {
      setResult(`네트워크/실행 오류: ${String(err?.message ?? err)}`);
    }
  }

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "24px auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>
        AI 투자 복기 리포트 (MVP)
      </h1>
      <p style={{ color: "#555" }}>
        버튼을 누르면 서버를 거쳐 AI가 복기 문장을 생성합니다.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          종목/티커
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          진입가
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          메모(진입/손절 근거)
          <textarea
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              minHeight: 110,
              marginTop: 6,
            }}
          />
        </label>

        <button
          onClick={onGenerate}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          AI 복기 리포트 생성
        </button>
      </div>

      {result && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>결과</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            {result}
          </pre>
        </section>
      )}
    </main>
  );
}
