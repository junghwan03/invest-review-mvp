import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ 매매 복기 가이드라인 (투자 행동 제안 절대 금지 원칙 준수)
function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 투자 코치다. 한국어 응답. [점수] N/10점 형식. 시장 데이터 분석만 제공하며 직접적인 매수/매도 제안은 금지한다.`;
  const guides = { long: "장기투자 가이드.", swing: "스윙 매매 가이드.", day: "단타 매매 가이드.", etf: "ETF 포트폴리오 가이드." };
  return `${guides[tradeType]} ${commonRules}`;
}

// ✅ 가격 멱살 필터 (정규식 고도화)
function filterPriceHallucination(text: string): string {
  return text
    .replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[시세 데이터 제외]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(USD|달러|불|원)\b/gi, "[시세 데이터 제외]")
    .replace(/(현재가|현재 주가|Price|Current Price):?\s*\[시세 데이터 제외\]/gi, "");
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
    let temp = 0.3; // 창의성과 일관성의 균형

    // 분기 1: 비전 분석
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [분기 2] 고수 비교 (섹터 가중치 채점 시스템 도입) ---
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `
너는 ${experts[body.expertId] || "투자 고수"}다. 사용자의 포트폴리오를 섹터(빅테크, 헬스케어 등)별로 정밀 분석하라.

[🚨 채점 프로토콜]
1. 섹터 보너스: 캐시 우드라면 혁신주/IT 섹터 비중이 높을 때 리스크 관리가 안 되었더라도 철학적 일치로 보아 최소 35~45점은 부여하라.
2. 0점 금지: 종목 중 하나라도 네가 평소 선호하는 섹터나 기업이라면 절대 0점을 주지 마라. 
3. 출력 형식: 분석 내용을 적은 후, 반드시 맨 마지막 줄에 "MATCH_RATE: [숫자]" 형식을 지켜라. (예: MATCH_RATE: 42)
4. 투자 제안 금지: 분할 매수/수익 실현 등의 직접적인 행동 지시는 절대 하지 않는다.
`.trim();
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 네 철학과의 일치도를 분석하고 MATCH_RATE를 작성하라.`;
    }
    // 분기 3: 매매 복기
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [메모] ${body.reasonNote || ""}`;
    }
    // --- [분기 4] 심층 분석 (가독성 예시 템플릿 강제) ---
    else {
      systemPrompt = `
너는 월가 애널리스트다. 가격 정보는 필터링되므로 언급하지 마라.
가독성을 위해 반드시 아래 [템플릿] 구조를 엄수하라. 문장을 뭉쳐 쓰면 시스템 에러다.

[템플릿 예시]
## 🌐 산업 사이클 분석
이 산업은 현재 [성장/성숙/쇠퇴] 단계에 있습니다. 

---

## 📊 지표별 심층 진단

### 🥐 붕어빵 기계로 이해하는 PER
- **비유**: (붕어빵 기계 가격과 하루 수익의 비유...)
- **진단**: 현재 PER 수치는 시장의 높은 성장을 기대하고 있음을 의미합니다.

### 🏠 내 집 마련으로 이해하는 PBR
- **비유**: (집의 실거래가와 땅값의 비유...)
- **진단**: 순자산 대비 주가가 프리미엄을 받고 있는 상태입니다.

---

## 🎯 종합 결론
(데이터 기반의 객관적 요약. 리스크 중심 분석 제공.)
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 템플릿에 맞춰 분석하라.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 진짜 일치도 점수 추출 로직 강화 (대소문자 구분 없이 추출)
    let matchRate = 0;
    if (body.type === "comparison") {
      const match = text.match(/MATCH_RATE:\s*(\d+)/i);
      if (match) {
        matchRate = parseInt(match[1]);
        text = text.replace(/MATCH_RATE:\s*\d+/i, ""); // 본문에서 태그 삭제
      }
    }

    // 시세 데이터 제외 필터 적용 (심층 분석 및 복기 시)
    if (!body.type && !body.tradeType) {
      text = filterPriceHallucination(text);
    }

    return jsonResponse({ ok: true, text, matchRate }, 200);
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}