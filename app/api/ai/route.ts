import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 투자 코치다. 한국어로 답하라. [점수] N/10점 형식. 시장 데이터 분석만 제공하며 직접적인 매수/매도 제안은 금지한다.`;
  const guides = { long: "장기투자 가이드.", swing: "스윙 매매 가이드.", day: "단타 매매 가이드.", etf: "ETF 포트폴리오 가이드." };
  return `${guides[tradeType]} ${commonRules}`;
}

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
    let temp = 0.2;

    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `너는 ${experts[body.expertId] || "투자 고수"}다. 섹터 일치 시 최소 30점 이상 부여하라. 0점 금지. 마지막 줄에 MATCH_RATE: [숫자] 작성. 직접적 행동 제안 금지.`;
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 MATCH_RATE 작성.`;
    }
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [메모] ${body.reasonNote || ""}`;
    }
    else {
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급은 금지다. 
아래 [출력 예시]의 구조를 반드시 지켜라. 지표별로 "---" 구분선을 넣고 문장을 절대 뭉쳐 쓰지 마라.

[출력 예시]
## 🌐 산업 사이클 분석
이 산업은 현재 [단계]에 있습니다. (상세 내용...)

---

## 📊 지표별 상세 진단

### 🥐 붕어빵 기계로 이해하는 PER
- **비유**: (수수료나 기계값 비유...)
- **진단**: (데이터 분석...)

---

### 🏠 내 집 마련으로 이해하는 PBR
- **비유**: (건물가와 땅값 비유...)
- **진단**: (데이터 분석...)

---

### ☕ 커피숍 이익률로 이해하는 ROE
- **비유**: 내 돈을 투자해 커피를 팔아 얼마나 남겼는지의 비율입니다.
- **진단**: 현재 ROE 수치는 기업의 자본 효율성이 어떠한지 나타냅니다.

---

### 🛍️ 시장 가판대 매출로 이해하는 PSR
- **비유**: 물건을 얼마나 많이 팔았는지와 가판대 몸값의 관계입니다.
- **진단**: 매출 대비 주가 수준이 과대 혹은 과소 평가되었는지 진단합니다.

---

## 🎯 종합 결론
(데이터 기반의 객관적 리스크 중심 요약. 매수/매도 제안 금지.)
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 분석 리포트 작성.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    let matchRate = 0;
    if (body.type === "comparison") {
      const match = text.match(/MATCH_RATE[:\s]*(\d+)/i);
      if (match) {
        matchRate = parseInt(match[1]);
        text = text.replace(/MATCH_RATE[:\s]*\d+/gi, "").trim();
      }
    }

    if (!body.type && !body.tradeType) {
      text = filterPriceHallucination(text);
    }

    return jsonResponse({ ok: true, text, matchRate }, 200);
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}