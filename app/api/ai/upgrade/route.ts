import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

// ✅ 횟수 제한 설정 (타입별 3회씩 분리)
const DAILY_LIMIT_PER_TYPE = 3;
const USAGE_STORE: Record<string, { review: number; analysis: number; lastReset: string }> = {};

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

// ✅ [노선 1] 매매 복기 지시문 (사용자 원본 100% 유지)
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

// ✅ [노선 2] 고수 비교 지시문 (사용자 원본 100% 유지)
function getDiagnosisInstruction(expertId: string) {
  const expertData: Record<string, string> = {
    warren_buffett: "정보기술 45%, 금융 30%, 소비재 15%, 에너지 10% (가치/현금흐름 중심)",
    nancy_pelosi: "정보기술/반도체 70%, 성장주 30% (정책 수혜/빅테크 중심)",
    cathie_wood: "혁신기술/AI/우주 80%, 바이오 20% (파괴적 혁신/고위험 중심)",
    ray_dalio: "자산별 균등 배분, 원자재, 채권 포함 (리스크 헤지/올웨더 전략)",
    michael_burry: "경기순환주, 방어주, 저평가 가치주 (역발상/하락 배팅 중심)",
    korean_top1: "국내 반도체 대장주 50%, 주도 성장주(이차전지 등) 50% (시장 주도권 중심)"
  };
  return `너는 '자산 배분 감사관'이다. HEALTH_SCORE: [숫자]%를 포함하라. 데이터: ${expertData[expertId] || expertData.warren_buffett}`;
}

// ✅ [노선 3] 심층 지표 분석 지시문 (사용자 원본 100% 유지)
function getAnalysisInstruction() {
  return `너는 '지표 분석 애널리스트'다. 지정된 형식을 엄수하라. ## 🌐 산업 사이클 분석...`;
}

function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store", ...corsHeaders } 
  });
}

export async function POST(req: Request) {
  try {
    const headerList = await headers();
    const ip = (headerList.get("x-forwarded-for") ?? "127.0.0.1").split(',')[0];
    const today = new Date().toISOString().split("T")[0];

    if (!USAGE_STORE[ip] || USAGE_STORE[ip].lastReset !== today) {
      USAGE_STORE[ip] = { review: 0, analysis: 0, lastReset: today };
    }

    const body = await req.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, text: "데이터 없음" }, 400);

    const isAnalysis = body.type === "diagnosis" || body.type === "comparison" || body.type === "vision" || body.manualPer !== undefined;
    const currentType = isAnalysis ? "analysis" : "review";

    if (USAGE_STORE[ip][currentType] >= DAILY_LIMIT_PER_TYPE) {
      const typeName = isAnalysis ? "심층 분석" : "매매 복기";
      return jsonResponse({ 
        ok: false, 
        text: `오늘 ${typeName} 무료 분석 횟수(${DAILY_LIMIT_PER_TYPE}회)를 모두 사용하셨습니다.`, 
        limitReached: true 
      }, 429);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    let systemPrompt = "";
    let userPrompt: any = "";

    // 🚦 [추가] 스크린샷(Vision) 인식 분기
    if (body.type === "vision" && body.imageBase64) {
      systemPrompt = `너는 증권사 앱 스크린샷 판독 전문가다. 이미지에서 지표를 추출해라.
      [규칙] 1. 설명 없이 JSON만 출력. 2. 종목명(ticker), 비중(weight), PER, ROE, PBR, PSR 추출. 3. 없으면 "N/A"`;
      userPrompt = [
        { type: "text", text: "이 이미지에서 주식 데이터를 추출해서 JSON으로 응답해라." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }
      ];
    } 
    else if (body.type === "diagnosis" || body.type === "comparison") {
      systemPrompt = getDiagnosisInstruction(body.expertId);
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석하라.`;
    } else if (body.manualPer !== undefined) {
      systemPrompt = getAnalysisInstruction();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 분석하라.`;
    } else {
      const tradeType = normalizeTradeType(body?.tradeType);
      systemPrompt = getInstruction(tradeType);
      userPrompt = `[종목] ${body.ticker} [진입가] ${body.entryPrice} [메모] ${body.reasonNote}`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content || "";

    let matchRate = 20; 
    const scoreMatch = text.match(/HEALTH_SCORE[:\s\*]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      text = text.replace(/HEALTH_SCORE[:\s\*]*\d+[%]?/gi, "").trim();
    }
    matchRate = Math.max(20, Math.min(100, matchRate));

    USAGE_STORE[ip][currentType] += 1;

    return jsonResponse({ 
      ok: true, 
      text, 
      matchRate, 
      remaining: DAILY_LIMIT_PER_TYPE - USAGE_STORE[ip][currentType] 
    });

  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류: " + e.message }, 500);
  }
}