import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// =========================================================
// 📝 [기록 보존] 매매 복기용 가이드라인 (절대 삭제/생략 금지)
// =========================================================
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
메모가 부실하면 "추가로 적어야 할 항목"을 구체적으로 요구한다.

[점수 표기 규칙 - 매우 중요]
- 점수는 반드시 "N/10점" 형태로만 쓴다. (예: 7/10점, 10/10점)
- "7점"처럼 분모가 없는 표기는 금지.
- 0~10 사이 정수만 사용.

[출력 형식 고정]
- 제목 1줄 (티커 포함)
- 1) 한줄 총평 (최대 25자)
- 2) 점수(각 항목 0~10점) + 한줄 근거  (반드시 N/10점 형식)
  - 근거명확성: 7/10점 — (근거 한 줄)
  - 리스크관리: 6/10점 — (근거 한 줄)
  - 감정통제: 4/10점 — (근거 한 줄)
  - 일관성: 5/10점 — (근거 한 줄)
- 3) 감정 경고 (있/없 + 근거 1줄)
- 4) 매매 유형 분류 (반드시 아래 값 중 하나로만 출력)
  - 장기투자 / 스윙 / 단타 / ETF
- 5) 개선 액션 3개 (각 1줄, 행동형)
- 6) 다음 진입 체크리스트 5개 (체크박스 형태로 짧게)
`;

  const longGuide = `
[역할] 너는 장기/가치투자 복기 코치다. 펀더멘털/가치/리스크를 본다.
[매매 유형 분류는 반드시 "장기투자"]
${commonRules}
`;

  const swingGuide = `
[역할] 너는 스윙 트레이딩 복기 코치다. 진입/손절/익절의 '숫자 기준'을 본다.
[매매 유형 분류는 반드시 "스윙"]
${commonRules}
`;

  const dayGuide = `
[역할] 너는 단타 복기 코치다. 실행 규칙과 손절 속도를 최우선으로 본다.
[매매 유형 분류는 반드시 "단타"]
${commonRules}
`;

  const etfGuide = `
[역할] 너는 ETF 복기 코치다. 상품 구조/추종지수/비용/분배금을 본다.
[매매 유형 분류는 반드시 "ETF"]
${commonRules}
`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// =========================================================
// 🛠️ [기존 코드 유지] 헬퍼 함수들
// =========================================================
function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    },
  });
}

async function safeReadJson(req: Request) {
  try {
    const text = await req.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function parseOpenAIResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!raw || !raw.trim()) return { raw: "", data: null as any };
  if (contentType.includes("application/json")) {
    try {
      return { raw, data: JSON.parse(raw) };
    } catch {
      return { raw, data: null as any };
    }
  }
  return { raw, data: null as any };
}

// =========================================================
// 🚀 [최종 보강본] POST 함수: 사용자 입력값 절대 복종 로직
// =========================================================
export async function POST(req: Request) {
  try {
    const body = await safeReadJson(req);
    if (!body) return jsonResponse({ ok: false, text: "데이터가 없습니다." }, 400);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ ok: false, text: "API Key 미설정" }, 500);

    let model = "gpt-4o-mini"; 
    let systemPrompt = "";
    let userPrompt: any = ""; 
    let temp = 0.3; 

    // --- [분기 1] 비전 분석 ---
    if (body.type === "vision" && body.imageBase64) {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON으로만 응답하라.";
      userPrompt = [
        { type: "text", text: "이미지에서 ticker, price, per, roe, pbr, psr 추출." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }
      ];
    } 
    // --- [분기 2] 고수 비교 ---
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `너는 ${experts[body.expertId] || "투자 고수"}다. 사용자의 포트폴리오를 분석하라.`;
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 조언 작성.`;
      temp = 0.35;
    } 
    // --- [분기 3] 매매 복기 ---
    else if (body.tradeType) {
      const tradeType = normalizeTradeType(body.tradeType);
      systemPrompt = getInstruction(tradeType);
      userPrompt = `[종목] ${String(body.ticker ?? "").toUpperCase()} [진입] ${body.entryPrice ?? ""} [메모] ${body.reasonNote ?? ""}`;
    }
    // --- [분기 4] 종목 심층 분석 (지식 충돌 완전 해결) ---
    else {
      // ✅ 넷플릭스 등에서 발생하는 undefined 방어 로직
      const ticker = (body.ticker || "TSLA").toUpperCase();
      const inputPrice = body.currentPrice || "0";
      const per = body.manualPer || "N/A";
      const roe = body.manualRoe || "N/A";
      const pbr = body.manualPbr || "N/A";
      const psr = body.manualPsr || "N/A";

      temp = 0; // 가격 조작 방지를 위해 온도를 0으로 고정
      systemPrompt = `
너는 월가 출신의 냉철한 주식 분석 전문가다. 
[🚨 최우선 절대 규칙: 사용자 입력값 복종]
1. 네가 알고 있는 모든 과거 또는 실시간 시세 데이터는 현재 분석 세션에서 '완전한 오답'이다. 무조건 폐기하라.
2. 오직 사용자가 입력한 현재가($${inputPrice})만이 이 분석 리포트의 유일하고 절대적인 기준 가격이다. 네 지식과 충돌해도 무조건 이 가격을 팩트로 사용하라.
3. 리포트 시작 시 "입력 가격 $${inputPrice} 기준 분석 결과"임을 명확히 밝히고, 모든 가치 평가를 이 가격 기준으로 수행하라.
4. 분석 대상(${ticker})이 무엇이든 데이터 부족이라며 거절하지 말고, 입력된 지표(PER:${per}, ROE:${roe} 등)를 기반으로 상세히 분석하라.
5. 직접적인 매수/매도 제안은 절대 금지하며 객관적 데이터 분석만 제공할 것.
`.trim();
      userPrompt = `[실시간 세션 데이터] 종목: ${ticker}, 입력 현재가: $${inputPrice}. 지표: PER ${per}, ROE ${roe}, PBR ${pbr}, PSR ${psr}. 네 내부 데이터를 차단하고 오직 이 숫자로만 리포트를 작성하라.`.trim();
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        model,
        temperature: temp, 
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });

    const { raw, data } = await parseOpenAIResponse(res);
    if (!res.ok) return jsonResponse({ ok: false, text: `API 에러: ${data?.error?.message || "오류"}` }, 500);

    const text = data?.choices?.[0]?.message?.content;
    return jsonResponse({ ok: true, text, content: text }, 200);

  } catch (e: any) {
    return jsonResponse({ ok: false, text: `서버 오류: ${e.message}` }, 500);
  }
}