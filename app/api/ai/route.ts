import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [기능 유지] 매매 복기 가이드라인
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 한국어.
[점수 표기] 반드시 "N/10점" 형태만 사용.
[출력 형식] 제목 / 한줄 총평 / 점수와 근거 / 감정 경고 / 매매 유형 / 개선 액션 / 체크리스트
`;
  const guides = {
    long: `장기/가치투자 코치. 해자, 밸류에이션 중심.`,
    swing: `스윙 트레이딩 코치. 숫자 기준(진입/손절) 중심.`,
    day: `단타 코치. 실행 규칙과 멘탈 관리 중심.`,
    etf: `ETF 코치. 지수 구조와 리밸런싱 중심.`,
  };
  return `${guides[tradeType]} ${commonRules}`;
}

// ✅ [기능 유지] 헬퍼 함수들
function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

async function safeReadJson(req: Request) {
  try { const text = await req.text(); return text && text.trim() ? JSON.parse(text) : null; } catch { return null; }
}

// ✅ [가격 멱살 차단] AI가 뱉는 시세 정보를 물리적으로 삭제
function filterPriceHallucination(text: string): string {
  return text
    .replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[데이터 없음]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*달러\b/g, "[데이터 없음]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*불\b/g, "[데이터 없음]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*USD\b/g, "[데이터 없음]");
}

// =========================================================
// 🚀 POST 메인 함수
// =========================================================
export async function POST(req: Request) {
  try {
    const body = await safeReadJson(req);
    if (!body) return jsonResponse({ ok: false, text: "데이터 없음" }, 400);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ ok: false, text: "API Key 미설정" }, 500);

    let model = "gpt-4o-mini";
    let systemPrompt = "";
    let userPrompt: any = "";
    let temp = 0.3;

    // 분기 1: 비전 분석 (유지)
    if (body.type === "vision") {
      model = "gpt-4o"; temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON 응답.";
      userPrompt = [{ type: "text", text: "ticker, price, per, roe, pbr, psr, weight 추출." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }];
    }
    // 분기 2: 고수 비교 분석 (가짜 95% 방지 로직 추가)
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      const expertName = experts[body.expertId] || "투자 고수";
      
      systemPrompt = `
너는 ${expertName}의 투자 철학을 완벽히 대변하는 AI다. 
사용자의 포트폴리오를 보고 본인의 철학과 얼마나 일치하는지 0~100% 사이의 '진짜' 점수를 매겨라.
테슬라 100% 같은 포트폴리오가 워런 버핏 스타일이라고 하면 절대 안 된다. 매우 냉정하게 평가하라.
응답 마지막 줄에 반드시 "MATCH_SCORE: [점수]" 형식을 포함하라.
`;
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 조언을 작성하고 마지막에 일치도 점수를 적어줘.`;
    }
    // 분기 3: 매매 복기 (유지)
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [진입가] ${body.entryPrice} [메모] ${body.reasonNote || ""}`;
    }
    // 분기 4: 심층 분석 (정갈한 지표별 비유 분석 + 가격 차단)
    else {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();
      const per = body.manualPer || "데이터 없음";
      const roe = body.manualRoe || "데이터 없음";
      const pbr = body.manualPbr || "데이터 없음";
      const psr = body.manualPsr || "데이터 없음";

      temp = 0.2;
      systemPrompt = `
너는 월가 애널리스트다. 현재 시점은 2026년 1월 18일이다.
[🚨 규칙]
1. 가격 언급 절대 금지: 시세를 아는 척 숫자를 쓰면 에러다.
2. 지표별 독립 분석: PER, ROE, PBR, PSR을 절대 합치지 말고 각각 ## 소제목을 붙여 독립적으로 분석하라.
3. 비유 필수: '붕어빵', '식당 권리금' 등 실생활 비유를 반드시 포함하라.
4. 산업 사이클 분석을 최상단에 배치하라.
`;
      userPrompt = `종목: ${ticker}\n- PER: ${per}\n- ROE: ${roe}\n- PBR: ${pbr}\n- PSR: ${psr}\n\n정갈하게 지표별로 나누어 분석하라.`.trim();
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: temp, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });

    const rawRes = await res.json();
    let text = rawRes.choices?.[0]?.message?.content ?? "";

    // ✅ 가격 정보가 포함되어 있다면 필터링 (심층 분석에서만)
    if (!body.type && !body.tradeType) {
      text = filterPriceHallucination(text);
    }

    return jsonResponse({ ok: true, text, content: text }, 200);
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}