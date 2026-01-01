import { NextResponse } from "next/server";

type TradeType = "long" | "swing" | "day" | "etf";

/* =========================
   CORS 공통 헤더 (중요)
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* =========================
   OPTIONS (프리플라이트)
========================= */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
메모가 부실하면 "추가로 적어야 할 항목"을 구체적으로 요구한다.

[점수 표기 규칙 - 매우 중요]
- 점수는 반드시 "N/10점" 형태로만 쓴다.
- 0~10 사이 정수만 사용.

[출력 형식 고정]
- 제목 1줄 (티커 포함)
- 1) 한줄 총평 (최대 25자)
- 2) 점수 + 한줄 근거 (N/10점 형식)
- 3) 감정 경고
- 4) 매매 유형 분류
- 5) 개선 액션 3개
- 6) 다음 진입 체크리스트 5개
`;

  if (tradeType === "long") return `[매매 유형: 장기투자]\n${commonRules}`;
  if (tradeType === "swing") return `[매매 유형: 스윙]\n${commonRules}`;
  if (tradeType === "day") return `[매매 유형: 단타]\n${commonRules}`;
  return `[매매 유형: ETF]\n${commonRules}`;
}

/* =========================
   POST 메인 로직
========================= */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const tickerRaw = body?.ticker ?? "";
    const entryPrice = body?.entryPrice ?? "";
    const stopLoss = body?.stopLoss ?? null;
    const reasonNote = body?.reasonNote ?? "";
    const tradeType = normalizeTradeType(body?.tradeType);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { text: "OPENAI_API_KEY가 없습니다. (Vercel Env 확인 필요)" },
        { status: 500, headers: corsHeaders }
      );
    }

    const instruction = getInstruction(tradeType);

    const userContext = `
[매매유형] ${tradeType}
[종목] ${String(tickerRaw).toUpperCase()}
[진입가] ${entryPrice}
[손절가] ${stopLoss ?? "N/A"}
[메모]
${reasonNote}
`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: instruction.trim() },
          { role: "user", content: userContext.trim() },
        ],
      }),
    });

    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!res.ok) {
      const msg = data?.error?.message ?? raw;
      return NextResponse.json(
        { text: `OpenAI 에러 (${res.status}): ${msg}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const text = data?.choices?.[0]?.message?.content ?? "응답 없음";
    return NextResponse.json({ text }, { headers: corsHeaders });

  } catch (e: any) {
    return NextResponse.json(
      { text: `서버 오류: ${String(e?.message ?? e)}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
