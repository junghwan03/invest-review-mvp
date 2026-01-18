import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ 매매 복기 가이드라인 (기존 기능 100% 유지)
function getInstruction(tradeType: TradeType) {
  const commonRules = `너는 투자 코치다. 한국어 응답. [점수] N/10점 형식. [구조] 제목/총평/점수/근거/경고/액션/체크리스트.`;
  const guides = { long: "장기투자 가이드.", swing: "스윙 매매 가이드.", day: "단타 매매 가이드.", etf: "ETF 포트폴리오 가이드." };
  return `${guides[tradeType]} ${commonRules}`;
}

// ✅ 가격 멱살 필터 (더 꼼꼼하게 수정)
function filterPriceHallucination(text: string): string {
  return text
    .replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[시세 데이터 제외]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(USD|달러|불|불|원)\b/gi, "[시세 데이터 제외]")
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
    // 분기 2: 고수 비교 (가짜 95% 방지 로직)
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `너는 ${experts[body.expertId] || "투자 고수"}다. 사용자의 포트폴리오를 냉정하게 평가하고 마지막에 "MATCH_RATE: [0~100 사이 정수]"를 한 줄 추가해라. 테슬라 100% 같은 포트폴리오가 워런 버핏과 80% 이상 일치한다고 하면 에러다.`;
      userPrompt = `포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 MATCH_RATE 작성.`;
    }
    // 분기 3: 매매 복기
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [메모] ${body.reasonNote || ""}`;
    }
    // 분기 4: 심층 분석 (가독성 + 비유 강화)
    else {
      systemPrompt = `월가 애널리스트. 현재 2026년 1월 18일. 가격 언급 금지. ## 소제목으로 지표별 독립 분석. 실생활 비유 포함.`;
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 정갈하게 분석해.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const { data } = await parseOpenAIResponse(res);
    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 진짜 일치도 점수 추출
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