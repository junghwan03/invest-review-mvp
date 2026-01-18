import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [기능 유지] 매매 복기용 가이드라인 (절대 삭제/생략 금지)
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
[점수 표기 규칙] 반드시 "N/10점" 형태만 사용.
[출력 형식 고정] 제목 / 한줄 총평 / 점수와 근거 / 감정 경고 / 매매 유형 / 개선 액션 / 체크리스트
`;

  const longGuide = `너는 장기/가치투자 코치다. 펀더멘털/해자/밸류에이션을 중점적으로 봐라. ${commonRules}`;
  const swingGuide = `너는 스윙 트레이딩 코치다. 진입/손절/익절의 숫자 기준을 최우선으로 본다. ${commonRules}`;
  const dayGuide = `너는 단타 복기 코치다. 실행 규칙과 손절 속도, 멘탈 관리를 최우선으로 본다. ${commonRules}`;
  const etfGuide = `너는 ETF 복기 코치다. 상품 구조, 비용, 분배금, 포트폴리오 역할을 본다. ${commonRules}`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// ✅ [기능 유지] 헬퍼 함수들
function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function safeReadJson(req: Request) {
  try {
    const text = await req.text();
    return text && text.trim() ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function parseOpenAIResponse(res: Response) {
  const raw = await res.text();
  try { return { raw, data: JSON.parse(raw) }; } catch { return { raw, data: null }; }
}

// ✅ [가격 멱살 차단] AI가 아는 척하며 뱉는 가격 패턴($XXX)을 서버에서 물리적으로 삭제
function filterPriceHallucination(text: string): string {
  return text
    .replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "[데이터 없음]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*달러\b/g, "[데이터 없음]")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*불\b/g, "[데이터 없음]");
}

// =========================================================
// 🚀 POST 메인 함수
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

    // --- [분기 1] 비전 분석 (기능 유지) ---
    if (body.type === "vision" && body.imageBase64) {
      model = "gpt-4o";
      temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON으로만 응답하라.";
      userPrompt = [
        { type: "text", text: "이미지에서 ticker, price, per, roe, pbr, psr, weight 추출." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } },
      ];
    }
    // --- [분기 2] 비교 분석 (기능 유지) ---
    else if (body.type === "comparison") {
      const experts: any = { warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드", ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수" };
      systemPrompt = `너는 ${experts[body.expertId] || "투자 고수"}다. 사용자의 포트폴리오를 냉철하게 분석하라.`;
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 조언 작성.`;
    }
    // --- [분기 3] 매매 복기 (기능 유지) ---
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [진입가] ${body.entryPrice} [손절가] ${body.stopLoss || "N/A"} [메모] ${body.reasonNote || ""}`;
    }
    // --- [분기 4] 종목 심층 분석 (수정 포인트: 가격 차단 + 지표별 독립 분석 + 비유) ---
    else {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();
      
      // ✅ 넷플릭스/로켓랩 Undefined 방어: 비어있으면 "데이터 없음"으로 치환
      const per = body.manualPer || "데이터 없음";
      const roe = body.manualRoe || "데이터 없음";
      const pbr = body.manualPbr || "데이터 없음";
      const psr = body.manualPsr || "데이터 없음";

      temp = 0.2; 
      systemPrompt = `
너는 어려운 주식 지표를 초보자에게 비유로 설명해주는 월가 애널리스트다. 
현재 시점은 **2026년 1월 18일**이다.

[🚨 절대 엄수 규칙]
1. 가격(Price) 언급 금지: 테슬라 등 종목의 시세를 아는 척하지 마라. 숫자가 나오면 시스템 에러로 간주한다.
2. 지표별 독립 분석: PER, ROE, PBR, PSR을 한 문단에 합치지 말고 각각 독립된 섹션으로 나누어라.
3. 실생활 비유 포함: 각 지표 설명 시 '붕어빵 장사', '부동산', '용돈' 등에 비유한 설명을 반드시 1줄 포함하라.
4. 출력 구조: 
   ### 🏭 1. 산업 사이클 및 현재 위치
   (산업 상황 분석)
   ---
   ### 📊 2. 핵심 지표별 상세 진단
   - **PER**: (비유 설명) -> (수치 해석)
   - **ROE**: (비유 설명) -> (수치 해석)
   - **PBR**: (비유 설명) -> (수치 해석)
   - **PSR**: (비유 설명) -> (수치 해석)
   ---
   ### 💡 3. 종합 투자 포인트
   (객관적 분석 데이터만 제공할 것. 매수/매도 제안 금지)
`.trim();

      userPrompt = `종목: ${ticker}\n[데이터]\n- PER: ${per}\n- ROE: ${roe}\n- PBR: ${pbr}\n- PSR: ${psr}\n\n위 데이터를 정갈하게 지표별로 나누어 분석하라.`.trim();
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        model,
        temperature: temp,
        messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userPrompt } ],
      }),
    });

    const { raw, data } = await parseOpenAIResponse(res);
    if (!res.ok) return jsonResponse({ ok: false, text: "API 에러" }, 500);

    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 서버 후처리: 심층 분석 시 AI가 뱉은 잔여 가격 정보 물리적 제거
    if (!body.type && !body.tradeType) {
      text = filterPriceHallucination(text);
    }

    return jsonResponse({ ok: true, text, content: text }, 200);

  } catch (e: any) {
    return jsonResponse({ ok: false, text: `서버 오류: ${e.message}` }, 500);
  }
}