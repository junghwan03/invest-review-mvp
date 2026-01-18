import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 투자 코치다. 한국어로 답하라. [점수] N/10점 형식. 시장 데이터 분석만 제공하며 직접적인 매수/매도 제안은 절대 금지한다.`;
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
    let temp = 0.1; // 💡 온도를 극도로 낮춰 AI의 요약 본능을 억제

    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [분기 2] 자산 건전성 진단 (고수 비교 대체) ---
    else if (body.type === "diagnosis") {
      model = "gpt-4o";
      systemPrompt = `
너는 포트폴리오 전략가다. 사용자의 자산 구성을 분석하여 객관적인 '건전성 점수'를 산출하라.

[🚨 진단 프로토콜]
1. 첫 줄 형식: "HEALTH_SCORE: [숫자]" (분산도, 우량주 비중, 섹터 편중을 고려해 0~100점 사이 부여)
2. 분석 구조: 반드시 아래 '##' 헤더와 '---' 구분선을 사용하라. 뭉뚱그려 쓰면 시스템 에러다.
   - ## 🧩 섹터 및 자산 배분 현황
   - ## ⚠️ 주요 리스크 진단
   - ## 📈 향후 보완 전략
3. 직접적인 매수/매도 제안은 절대 금지한다.
`.trim();
      userPrompt = `포트폴리오 데이터: ${JSON.stringify(body.portfolio)}. 건전성을 분석하고 HEALTH_SCORE를 작성하라.`;
    }
    // --- [분기 4] 심층 지표 분석 (비유 절대 강제) ---
    else {
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급은 금지다. 
모든 지표는 반드시 아래 명시된 **개별 제목과 비유**를 토씨 하나 틀리지 말고 그대로 사용하라.

## 🌐 산업 사이클 분석
(현재 산업의 단계와 성장성 상세 분석)

---

## 📊 지표별 상세 진단

### 🥐 붕어빵 기계로 이해하는 PER
- **비유**: 붕어빵 기계 한 대의 가격과 하루 벌어들이는 수익의 관계입니다.
- **진단**: (현재 PER 수치를 기반으로 주가가 비싼지 분석)

---

### 🏠 내 집 마련으로 이해하는 PBR
- **비유**: 집의 실제 건물 가격과 땅값(순자산)의 관계입니다.
- **진단**: (현재 PBR 수치를 기반으로 자산 가치 대비 프리미엄 분석)

---

### ☕ 커피숍 이익률로 이해하는 ROE
- **비유**: 내 돈(자본)을 투자해 커피를 팔아 실제로 남긴 순이익의 비율입니다.
- **진단**: (현재 ROE 수치를 기반으로 기업의 자본 운용 효율성 분석)

---

### 🛍️ 시장 가판대 매출로 이해하는 PSR
- **비유**: 물건을 얼마나 많이 팔았는지와 그 가판대의 권리금(시가총액)의 관계입니다.
- **진단**: (현재 PSR 수치를 기반으로 매출 대비 주가 수준 분석)

---

## 🎯 종합 결론
(데이터 기반의 객관적 리스크 중심 요약. 행동 제안 금지.)
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

    // ✅ 점수 추출 (HEALTH_SCORE 대응)
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