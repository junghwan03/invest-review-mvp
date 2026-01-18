import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ 매매 복기 가이드라인 (유지)
function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 투자 코치다. 한국어 응답. [점수] N/10점 형식. [구조] 제목/총평/점수/근거/경고/액션/체크리스트.`;
  const guides = { long: "장기투자 가이드.", swing: "스윙 매매 가이드.", day: "단타 매매 가이드.", etf: "ETF 포트폴리오 가이드." };
  return `${guides[tradeType]} ${commonRules}`;
}

// ✅ 가격 멱살 필터
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
    let temp = 0.2;

    // 분기 1: 비전 분석
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [분기 2] 고수 비교 (섹터 가중치 및 점수 하한선 적용) ---
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `
너는 ${experts[body.expertId] || "투자 고수"}다. 

[포괄적 채점 가이드라인]
1. 섹터 분석: 사용자의 종목을 빅테크, 헬스케어, 에너지 등으로 분류하라.
2. 점수 산출: 네가 선호하는 섹터가 포함되어 있다면 일치도를 높게 평가하라.
   - 예: 캐시 우드라면 사용자가 빅테크(테슬라, 애플 등)를 가지고 있다면 0점이 아닌 최소 30~40점은 부여하라.
3. 점수 하한선: 섹터가 하나라도 겹치면 절대 0점을 주지 마라.
4. 마지막 줄 형식: MATCH_RATE: [숫자]
`.trim();
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 MATCH_RATE 작성.`;
    }
    // 분기 3: 매매 복기
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [메모] ${body.reasonNote || ""}`;
    }
    // --- [분기 4] 심층 분석 (출력 예시 강제 주입) ---
    else {
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급은 절대 금지다.
반드시 아래 [출력 예시]의 형식을 토씨 하나 틀리지 말고 지켜라. 뭉쳐 쓰면 시스템 에러다.

[출력 예시]
## 🌐 산업 사이클 분석
이 산업은 현재 [성장/성숙/쇠퇴] 단계입니다. (상세 분석...)

---

## 📊 지표별 상세 진단

### 붕어빵으로 비유하는 PER
- **비유**: (붕어빵 기계 한 대의 가격과 수익의 관계 등...)
- **진단**: 현재 수치는 (어떠하며...) 시장의 기대치가 (어떠하다...)

### 집값으로 비유하는 PBR
- **비유**: (집의 실거래가와 공시지가의 관계 등...)
- **진단**: (현재 자산 가치 대비 주가 상태 설명...)

... (ROE, PSR도 동일한 구조로 반복)

---

## 🎯 종합 결론
(최종 요약 및 리스크 체크포인트 작성. 매수/매도 제안은 금지.)
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 위 예시 형식대로 분석하라.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    let matchRate = null;
    if (body.type === "comparison") {
      const match = text.match(/MATCH_RATE:\s*(\d+)/);
      if (match) {
        matchRate = parseInt(match[1]);
        text = text.replace(/MATCH_RATE:\s*\d+/, "");
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