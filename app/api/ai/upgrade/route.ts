import { NextResponse } from "next/server";

// ✅ [Vercel 배포용] Vercel 배포 시 필수 (토스 빌드 땐 // 주석 처리)
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [노선 1] 매매 복기 지시문
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
메모가 부실하면 "추가로 적어야 할 항목"을 구체적으로 요구한다.

[점수 표기 규칙 - 매우 중요]
- 점수는 반드시 "N/10점" 형태로만 쓴다. (예: 7/10점, 10/10점)
- "7점"처럼 분모가 없는 표기는 금지.
- 0~10 사이 정수만 사용.

[출력 형식 고정 - 형식 엄수]
- 제목 1줄 (티커 포함)
- 1) 한줄 총평 (최대 25자)
- 2) 점수(각 항목 0~10점) + 한줄 근거 (반드시 N/10점 형식)
  - 근거 작성 시 괄호 ()를 절대 사용하지 않고 문장으로만 작성한다.
  - 근거명확성: N/10점 — 근거 한 줄
  - 리스크관리: N/10점 — 근거 한 줄
  - 감정통제: N/10점 — 근거 한 줄
  - 일관성: N/10점 — 근거 한 줄
- 3) 감정 경고: [있음/없음] — 근거 1줄 (괄호 사용 금지)
- 4) 매매 유형 분류 (반드시 아래 값 중 하나로만 출력)
  - 장기투자 / 스윙 / 단타 / ETF
- 5) 개선 액션 3개 (각 1줄, 행동형)
- 6) 다음 진입 체크리스트 5개 (체크박스 형태로 짧게)
`;
  const longGuide = `[역할] 너는 장기/가치투자 복기 코치다. ${commonRules}`;
  const swingGuide = `[역할] 너는 스윙 트레이딩 복기 코치다. ${commonRules}`;
  const dayGuide = `[역할] 너는 단타 복기 코치다. ${commonRules}`;
  const etfGuide = `[역할] 너는 ETF 복기 코치다. ${commonRules}`;
  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// ✅ [노선 2] 고수 비교 지시문
function getDiagnosisInstruction(expertId: string) {
  const expertData: Record<string, string> = {
    warren_buffett: "정보기술/금융/소비재 중심의 가치투자 및 해자 기업",
    nancy_pelosi: "과학기술/정보기술 정책 수혜주 및 시장 주도주",
    cathie_wood: "과학기술 혁신, AI, 우주 등 고성장 파괴적 혁신주",
    ray_dalio: "자산 배분, 원자재, 채권 포함 리스크 헤지 전략",
    michael_burry: "경기순환주, 저평가 가치주 및 역발상 투자",
    korean_top1: "국내 과학기술/반도체 대장주 및 주도 트렌드 매매"
  };

  return `너는 '투자 철학 진단관'이다.
  [분석 규칙] 종목을 개별로 보지 말고 '과학기술', '금융', '제조' 등 포괄적인 섹터 관점에서 분석하라. 특히 빅테크는 '과학기술/정보기술' 섹터로 통합하여 판단하라.

  [임무] 사용자의 포트폴리오를 ${expertId}의 투자 스타일(${expertData[expertId]})과 대조하여 다음 항목을 작성하라.
  
  1. 공통점: 고수의 철학과 섹터 비중 측면에서 일치하는 부분.
  2. 차이점: 리스크 관리나 섹터 편중도에서 고수와 가장 크게 대조되는 지점.
  3. 행동 강령: 고수의 관점에서 현재 포트폴리오를 유지/수정하기 위한 핵심 행동 지침.

  [필수] 답변 맨 마지막 줄에만 'HEALTH_SCORE: [숫자]' 형식으로 일치율을 적어라. 본문에는 HEALTH_SCORE라는 단어를 절대 쓰지 마라.`;
}

// ✅ [노선 3] 심층 지표 분석 지시문
function getAnalysisInstruction() {
  return `너는 '지표 분석 애널리스트'다. 지정된 형식을 엄수하라. ## 🌐 산업 사이클 분석... ## 📊 지표별 상세 판단... ## ⚖️ 종합 판단...`; 
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, text: "데이터 없음" }, { status: 400, headers: corsHeaders });

    const apiKey = process.env.OPENAI_API_KEY;
    let systemPrompt = "";
    let userPrompt: any = "";

    // 🔥 [수정됨] 테슬라 같은 스크린샷 인식을 위한 강력한 영어 프롬프트
    if (body.type === "vision" && body.imageBase64) {
      systemPrompt = `You are a strict Data Extraction AI. 
      Analyze the stock app screenshot provided.
      Extract ONLY the following numbers. Do not explain. Do not calculate.
      
      Required Fields:
      - ticker (e.g., TSLA, AAPL, or Korean Name)
      - per (Price Earnings Ratio)
      - pbr (Price Book Value Ratio)
      - roe (Return on Equity)
      - psr (Price Sales Ratio)
      - weight (Portfolio weight in %, if visible. otherwise "N/A")

      Output Format (JSON ONLY):
      {
        "extracted": [
          {
            "ticker": "string",
            "per": "number or string",
            "pbr": "number or string",
            "roe": "number or string",
            "psr": "number or string",
            "weight": "number or string"
          }
        ]
      }`;
      
      userPrompt = [
        { type: "text", text: "Extract stock data from this image. Output valid JSON only." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }
      ];
    } 
    else if (body.type === "diagnosis" || body.type === "comparison") {
      systemPrompt = getDiagnosisInstruction(body.expertId);
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석하라.`;
    } 
    else if (body.manualPer !== undefined) {
      systemPrompt = getAnalysisInstruction();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 분석하라.`;
    } 
    else {
      const tradeType = normalizeTradeType(body?.tradeType);
      systemPrompt = getInstruction(tradeType);
      userPrompt = `[종목] ${body.ticker} [진입가] ${body.entryPrice} [메모] ${body.reasonNote}`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0, // 0으로 설정해야 창의성 없이 팩트만 인식함
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        // 🔥 Vision 모드일 때 JSON 강제 출력 옵션 활성화
        response_format: body.type === "vision" ? { type: "json_object" } : undefined 
      }),
    });

    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content || "";

    // ✅ [2중 안전장치] JSON 추출 및 정제
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      text = text.replace(/```json|```/g, "").trim();
    }

    let matchRate = 20; 
    const scoreMatch = text.match(/HEALTH_SCORE[:\s\*]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      text = text.replace(/HEALTH_SCORE[:\s\*]*\d+[%]?/gi, "").trim();
    }
    matchRate = Math.max(20, Math.min(100, matchRate));

    return NextResponse.json({ ok: true, text, matchRate }, { headers: corsHeaders });

  } catch (e: any) {
    return NextResponse.json({ ok: false, text: "서버 오류: " + e.message }, { status: 500, headers: corsHeaders });
  }
}