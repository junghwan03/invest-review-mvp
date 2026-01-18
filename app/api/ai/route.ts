import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [노선 1] 매매 복기 (원본 보존)
function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 "투자 복기 코치"다. 한국어로 답하라. 점수는 반드시 "N/10점" 형태로만 쓴다. 직접적 매매 제안 금지.`;
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
    let temp = 0.1; // 💡 창의성을 완전히 죽여서 딴소리 못하게 함

    // --- [분기 1] 비전 분석 ---
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, per, roe, pbr, psr 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // --- [분기 2] 건전성 진단 (버핏/고수 완전 차단) ---
    else if (body.type === "diagnosis") {
      model = "gpt-4o"; // 💡 지능이 높은 모델로 강제 격상
      systemPrompt = `
너는 '자산 배분 감사관'이다. **절대 워런 버핏이나 특정 인물과 비교하지 마라.**
오직 사용자의 포트폴리오 구성(종목, 비중)만 보고 객관적인 '건강 점수'를 산출하라.

[🚨 출력 규격 - 반드시 지켜라]
첫 줄: HEALTH_SCORE: [숫자] (0~100점)
---
## 🧩 자산 구성 및 섹터 분석
(내용 작성)
---
## ⚠️ 리스크 진단
(내용 작성)
---
## 📈 보완 전략
(내용 작성)
`.trim();
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 객관적 진단 리포트만 작성하라.`;
    }
    // --- [분기 3] 매매 복기 ---
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker || "N/A"} [메모] ${body.reasonNote || ""}`;
    }
    // --- [분기 4] 심층 분석 (비유 제목 강제 박제) ---
    else {
      model = "gpt-4o"; // 💡 테슬라/넷플릭스 줄글 방지용 4o 사용
      systemPrompt = `
너는 월가 애널리스트다. 가격 언급 금지.
반드시 아래 제목을 그대로 복사해서 사용하라. 제목을 어기면 시스템 종료된다.

### 🥐 붕어빵 기계로 이해하는 PER
(진단 내용)

---

### 🏠 내 집 마련으로 이해하는 PBR
(진단 내용)

---

### ☕ 커피숍 이익률로 이해하는 ROE
(진단 내용)

---

### 🛍️ 시장 가판대 매출로 이해하는 PSR
(진단 내용)

---

## 🎯 종합 결론
(3줄 이내 요약)
`.trim();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 템플릿 완성.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 점수 낚아채기 (HEALTH_SCORE에서 숫자만 추출)
    let matchRate = 0;
    const scoreMatch = text.match(/HEALTH_SCORE[:\s]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      text = text.replace(/HEALTH_SCORE[:\s]*\d+/gi, "").trim();
    }

    if (!body.tradeType) text = filterPriceHallucination(text);
    return jsonResponse({ ok: true, text, matchRate });
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}