import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [노선 1] 매매 복기 가이드라인 (사용자 원본 로직 100% 보존)
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
[점수 표기 규칙] 반드시 "N/10점" 형태로만 쓴다. (예: 7/10점, 10/10점)

[출력 형식 고정]
- 제목 1줄 (티커 포함)
- 1) 한줄 총평 (최대 25자)
- 2) 점수(각 항목 0~10점) + 한줄 근거 (반드시 N/10점 형식)
  - 근거명확성: N/10점 — (근거)
  - 리스크관리: N/10점 — (근거)
  - 감정통제: N/10점 — (근거)
  - 일관성: N/10점 — (근거)
- 3) 감정 경고 (있/없 + 근거)
- 4) 매매 유형 분류 (장기투자 / 스윙 / 단타 / ETF)
- 5) 개선 액션 3개 / 6) 다음 진입 체크리스트 5개
`;
  const guides = { long: "장기투자 코치.", swing: "스윙 코치.", day: "단타 코치.", etf: "ETF 코치." };
  return `${guides[tradeType]} ${commonRules}`;
}

function filterPriceHallucination(text: string): string {
  return text.replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[시세 제외]")
             .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(USD|달러|원)\b/gi, "[시세 제외]");
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
    let model = "gpt-4o-mini";
    let systemPrompt = "";
    let userPrompt: any = "";
    let temp = 0.2;

    // --- [분기 1] 비전 분석 ---
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [분기 2] 건전성 진단 (0점 방지 + 버핏 차단) ---
    else if (body.type === "diagnosis") {
      model = "gpt-4o"; // 지시 이행력이 높은 4o 모델 강제 사용
      systemPrompt = `
너는 '객관적 자산 배분 전략가'다. 
[🚨 절대 금기] 워런 버핏, 낸시 펠로시 등 특정 인물이나 고수를 절대 언급하지 마라. 타인과 비교하지 마라.

[출력 규격]
1. 첫 줄에 무조건 "HEALTH_SCORE: [숫자]" (0~100점)만 딱 써라.
2. 아래 3개 섹션을 '##' 헤더와 '---' 구분선으로 작성하라.
   - ## 🧩 섹터 및 자산 배분 현황
   - ## ⚠️ 주요 리스크 진단
   - ## 📈 향후 보완 전략
`.trim();
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 객관적이고 차가운 데이터 분석을 수행하라.`;
    }
    // --- [분기 3] 매매 복기 (원본 보존) ---
    else if (body.tradeType) {
      model = "gpt-4o-mini";
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker || "N/A"} [진입가] ${body.entryPrice || "N/A"} [메모] ${body.reasonNote || ""}`;
    }
    // --- [분기 4] 심층 분석 (붕어빵 비유 멱살 고정) ---
    else {
      model = "gpt-4o"; // 테슬라/넷플릭스 줄글 방지를 위해 4o 격상
      temp = 0.1;
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급 금지.
반드시 아래 [출력 양식]을 복사해서 ( ) 부분만 채워라. 줄글 요약 시 시스템 종료된다.

[출력 양식]
## 🌐 산업 사이클 분석
(성장 단계 분석)
---
### 🥐 붕어빵 기계로 이해하는 PER
- 비유: 붕어빵 기계 가격과 하루 수익의 관계입니다.
- 진단: (데이터 분석)
---
### 🏠 내 집 마련으로 이해하는 PBR
- 비유: 건물 가치와 땅값의 관계입니다.
- 진단: (데이터 분석)
---
### ☕ 커피숍 이익률로 이해하는 ROE
- 비유: 내 돈 투자 대비 남긴 순이익 비율입니다.
- 진단: (데이터 분석)
---
### 🛍️ 시장 가판대 매출로 이해하는 PSR
- 비유: 가판대 권리금과 매출의 관계입니다.
- 진단: (데이터 분석)
---
## 🎯 종합 결론
(리스크 중심 요약. 투자 권유 금지.)
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 템플릿 완성하라.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ [해결] 점수 파싱 강화: 어떤 단어(HEALTH_SCORE, 점수 등) 뒤에 숫자가 오든 낚아챔
    let matchRate = 0;
    const scoreMatch = text.match(/(?:HEALTH_SCORE|MATCH_RATE|점수|SCORE)[:\s]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      text = text.replace(/(?:HEALTH_SCORE|MATCH_RATE|점수|SCORE)[:\s]*\d+/gi, "").trim();
    }

    if (!body.tradeType) text = filterPriceHallucination(text);

    return jsonResponse({ ok: true, text, matchRate });
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}