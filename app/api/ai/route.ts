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
    // --- [분기 4] 종목 심층 분석 (가격 배제 + 지표별 개별 분석) ---
    else {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();
      
      // ✅ Undefined 원천 차단: 값이 없으면 무조건 "데이터 없음"으로 치환
      const per = body.manualPer || "데이터 없음";
      const roe = body.manualRoe || "데이터 없음";
      const pbr = body.manualPbr || "데이터 없음";
      const psr = body.manualPsr || "데이터 없음";

      temp = 0.2; 
      systemPrompt = `
너는 월가 출신의 수석 애널리스트다. 현재 시점은 **2026년 1월 18일**이다.

[🚨 분석 원칙: 지표별 독립 분석]
1. 제공된 각 지표(PER, ROE, PBR, PSR)를 절대 합쳐서 설명하지 마라.
2. 각 지표마다 하나의 독립된 문단 혹은 섹션을 할당하여 분석하라. 
   - 예: "PER은 현재 ~이므로 ~하다." (다음 줄) "ROE는 현재 ~이므로 ~하다."
3. 사용자가 입력한 수치만을 근거로 하되, 수치가 "데이터 없음"인 경우 해당 지표 분석은 생략하거나 필요한 데이터가 무엇인지 짧게 언급하라.
4. 분석 과정에서 현재 주가(Price)를 언급하거나 추측하지 마라. 오직 '비율(Ratio)'과 '지표'의 논리에만 집중하라.
5. [필수 포함 섹션] 
   - 산업 사이클 분석 (해당 종목이 속한 산업의 현재 위치)
   - 종합 결론 (지표들을 종합한 정성적 평가)

[금지 사항]
- 매수/매도 제안, 수익 실현 등 투자 행동 제안 절대 금지.
- 객관적인 데이터 분석과 시장 상태만 제공할 것.
`.trim();

      userPrompt = `
종목: ${ticker}
[입력 데이터]
- PER: ${per}
- ROE: ${roe}
- PBR: ${pbr}
- PSR: ${psr}

위 데이터를 바탕으로 리포트를 작성하라. 각 지표는 반드시 개별적으로 줄바꿈을 하여 분석할 것.
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