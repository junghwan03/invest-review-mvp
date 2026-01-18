import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// =========================================================
// 📝 [기록 보존] 매매 복기용 가이드라인
// =========================================================
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
[점수 표기 규칙] 반드시 "N/10점" 형태만 사용.
[출력 형식] 제목 / 한줄 총평 / 점수와 근거 / 감정 경고 / 매매 유형 / 개선 액션 / 체크리스트
`;

  const longGuide = `[역할] 장기/가치투자 코치. 펀더멘털 중심. ${commonRules}`;
  const swingGuide = `[역할] 스윙 트레이딩 코치. 진입/손절 숫자 기준 중심. ${commonRules}`;
  const dayGuide = `[역할] 단타 코치. 실행 규칙과 손절 속도 중심. ${commonRules}`;
  const etfGuide = `[역할] ETF 코치. 지수 구조와 비용/분배금 중심. ${commonRules}`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// =========================================================
// 🛠️ 헬퍼 함수들
// =========================================================
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
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function parseOpenAIResponse(res: Response) {
  const raw = await res.text();
  try {
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { raw, data: null };
  }
}

// =========================================================
// 🚀 POST 함수
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

    if (body.type === "vision" && body.imageBase64) {
      model = "gpt-4o";
      temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON으로만 응답하라.";
      userPrompt = [
        { type: "text", text: "이미지에서 ticker, price, per, roe, pbr, psr, weight 추출." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } },
      ];
    } 
    else if (body.type === "comparison") {
      systemPrompt = "투자 고수로서 포트폴리오를 냉철하게 분석하라.";
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 조언 작성.`;
    } 
    else if (body.tradeType) {
      systemPrompt = getInstruction(normalizeTradeType(body.tradeType));
      userPrompt = `[종목] ${body.ticker} [진입가] ${body.entryPrice} [메모] ${body.reasonNote}`;
    } 
    // --- [분기 4] 종목 심층 분석 (비유 설명 추가 버전) ---
    else {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();
      
      // ✅ Undefined 방어막
      const per = body.manualPer || "데이터 없음";
      const roe = body.manualRoe || "데이터 없음";
      const pbr = body.manualPbr || "데이터 없음";
      const psr = body.manualPsr || "데이터 없음";

      temp = 0.3; // 비유를 풍부하게 하기 위해 온도를 살짝 올림
      systemPrompt = `
너는 어려운 주식 지표를 초보자도 한눈에 이해하게 설명하는 '친절한 월가 수석 애널리스트'다.
현재 시점은 **2026년 1월 18일**이다.

[🚨 분석 및 설명 원칙]
1. 지표별 독립 분석: PER, ROE, PBR, PSR을 절대 묶지 말고 각각 독립된 섹션으로 설명하라.
2. 쉬운 비유 필수: 각 지표의 정의를 설명할 때, '붕어빵 장사', '부동산', '은행 예금' 등 실생활 비유를 반드시 1줄 이상 포함하라.
   - 예 (PER): "이 기업이 버는 돈 대비 몸값이 얼마인지 보여줍니다. (비유: 연봉 1억인 사람의 몸값을 10억으로 쳐줄지, 100억으로 쳐줄지 결정하는 것과 같습니다.)"
   - 예 (ROE): "자기 자본으로 얼마나 알차게 수익을 냈는지 보여줍니다. (비유: 내 돈 1억으로 카페를 차려 1년에 2천만 원을 벌었다면 ROE는 20%가 됩니다.)"
3. 수치 기반 분석: 사용자가 입력한 수치가 "데이터 없음"인 경우 해당 지표 분석 섹션 자체를 출력하지 마라.
4. 가격 언급 금지: 주가(Price)를 추측하거나 언급하지 마라.
5. 섹션 구성: 지표별 설명 -> 산업 사이클 분석 -> 종합 결론 순서로 작성하라.

[금지 사항]
- 분할 매수, 수익 실현 등 투자 행동 제안은 절대로 하지 마라.
- 오직 객관적인 데이터 분석과 시장 상태만 제공하라.
`.trim();

      userPrompt = `
종목: ${ticker}
[분석 데이터]
- PER: ${per}
- ROE: ${roe}
- PBR: ${pbr}
- PSR: ${psr}

초보자도 이해할 수 있게 각 지표를 비유와 함께 개별적으로 분석해주고, 산업 위치와 최종 결론을 내줘.
`.trim();
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        model,
        temperature: temp,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const { raw, data } = await parseOpenAIResponse(res);
    if (!res.ok) return jsonResponse({ ok: false, text: "API 에러 발생" }, 500);

    const text = data?.choices?.[0]?.message?.content ?? "";
    return jsonResponse({ ok: true, text, content: text }, 200);

  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류 발생" }, 500);
  }
}