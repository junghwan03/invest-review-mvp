import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [노선 1] 원본 매매 복기 가이드라인 복구
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
- 4) 매매 유형 분류 (장기투자 / 스윙 / 단타 / ETF)
- 5) 개선 액션 3개 (각 1줄, 행동형)
- 6) 다음 진입 체크리스트 5개 (체크박스 형태로 짧게)
`;

  const longGuide = `너는 장기/가치투자 복기 코치다. 펀더멘털/가치/리스크 중심. ${commonRules}`;
  const swingGuide = `너는 스윙 트레이딩 복기 코치다. 진입/손절/익절 '숫자 기준' 중심. ${commonRules}`;
  const dayGuide = `너는 단타 복기 코치다. 즉시 손절과 원칙 준수 중심. ${commonRules}`;
  const etfGuide = `너는 ETF 복기 코치다. 구조/비용/리밸런싱/포트 역할 중심. ${commonRules}`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// ✅ 가격 멱살 필터
function filterPriceHallucination(text: string): string {
  return text
    .replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[시세 제외]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(USD|달러|불|원)\b/gi, "[시세 제외]")
    .replace(/(현재가|현재 주가|Price|Current Price):?\s*\[시세 제외\]/gi, "");
}

function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

async function parseOpenAIResponse(res: Response) {
  const raw = await res.text();
  try { return { raw, data: JSON.parse(raw) }; } catch { return { raw, data: null }; }
}

export async function POST(req: Request) {
  try {
    const textBody = await req.text();
    const body = textBody ? JSON.parse(textBody) : null;
    if (!body) return jsonResponse({ ok: false, text: "데이터 없음" }, 400);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ ok: false, text: "API Key 미설정" }, 500);

    let model = "gpt-4o-mini";
    let systemPrompt = "";
    let userPrompt: any = "";
    let temp = 0.25;

    // --- [노선 1] 비전 분석 (스크린샷 데이터 추출) ---
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [노선 2] 건전성 진단 (Expert 비교 대체) ---
    else if (body.type === "diagnosis") {
      model = "gpt-4o";
      systemPrompt = `
너는 포트폴리오 전략가다. 사용자의 자산 구성을 분석하여 객관적인 '건전성 점수'를 산출하라.
[🚨 규칙] 
1. 첫 줄에 반드시 "HEALTH_SCORE: [숫자]" (0~100점) 작성.
2. 섹터 집중도, 리스크, 보완 전략을 '##' 헤더와 '---' 구분선으로 나누어 작성.
3. 직접적 투자 권유(분할 매수 등) 금지.
`.trim();
      userPrompt = `포트폴리오: ${JSON.stringify(body.portfolio)}. 건전성 진단 리포트 작성.`;
    }
    // --- [노선 3] 매매 복기 (사용자 원본 로직 복구) ---
    else if (body.tradeType) {
      const tradeType = normalizeTradeType(body.tradeType);
      systemPrompt = getInstruction(tradeType);
      userPrompt = `[종목] ${body.ticker || "N/A"} [진입가] ${body.entryPrice || "N/A"} [메모] ${body.reasonNote || ""}`;
    }
    // --- [노선 4] 심층 지표 분석 (비유 강제 주입) ---
    else {
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급은 금지다. 지표별로 반드시 아래 비유 제목을 그대로 사용하라.
### 🥐 붕어빵 기계로 이해하는 PER (수익 비유)
### 🏠 내 집 마련으로 이해하는 PBR (자산 비유)
### ☕ 커피숍 이익률로 이해하는 ROE (자본 효율 비유)
### 🛍️ 시장 가판대 매출로 이해하는 PSR (매출 권리금 비유)
섹션 사이에 "---" 구분선을 반드시 사용하라.
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 템플릿 분석 작성.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 점수 파싱 (건전성 점수 대응)
    let matchRate = 0;
    const scoreMatch = text.match(/(?:HEALTH_SCORE|MATCH_RATE)[:\s]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      text = text.replace(/(?:HEALTH_SCORE|MATCH_RATE)[:\s]*\d+/gi, "").trim();
    }

    if (!body.type && !body.tradeType) text = filterPriceHallucination(text);

    return jsonResponse({ ok: true, text, matchRate });
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}