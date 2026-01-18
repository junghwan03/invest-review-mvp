import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// ✅ [노선 1] 매매 복기 지시문 (240줄 원본 로직 전체 보존)
function getInstruction(tradeType: TradeType) {
  const commonRules = `
너는 "투자/트레이딩 복기 코치"다. 출력은 반드시 한국어.
장황하지 않게, "기준/행동/숫자" 중심으로 쓴다.
메모가 부실하면 "추가로 적어야 할 항목"을 구체적으로 요구한다.

[점수 표기 규칙 - 매우 중요]
- 점수는 반드시 "N/10점" 형태로만 쓴다. (예: 7/10점, 10/10점)
- "7점"처럼 분모가 없는 표기는 금지.
- 0~10 사이 정수만 사용.

[출력 형식 고정]
- 제목 1줄 (티커 포함)
- 1) 한줄 총평 (최대 25자)
- 2) 점수(각 항목 0~10점) + 한줄 근거 (반드시 N/10점 형식)
  - 근거명확성: 7/10점 — (근거 한 줄)
  - 리스크관리: 6/10점 — (근거 한 줄)
  - 감정통제: 4/10점 — (근거 한 줄)
  - 일관성: 5/10점 — (근거 한 줄)
- 3) 감정 경고 (있/없 + 근거 1줄)
- 4) 매매 유형 분류 (반드시 아래 값 중 하나로만 출력)
  - 장기투자 / 스윙 / 단타 / ETF
- 5) 개선 액션 3개 (각 1줄, 행동형)
- 6) 다음 진입 체크리스트 5개 (체크박스 형태로 짧게)
`;

  const longGuide = `
[역할] 너는 장기/가치투자 복기 코치다. 단타/차트 얘기를 줄이고, 펀더멘털/가치/리스크를 본다.
[중점 평가] 기업의 해자, 밸류에이션, 재무 안전성, 장기 시나리오, Thesis break.
${commonRules}`;

  const swingGuide = `
[역할] 너는 스윙 트레이딩 복기 코치다. 진입/손절/익절의 '숫자 기준'을 중요하게 본다.
[중점 평가] 진입 트리거, 손절 숫자, 익절/분할 기준, 손익비(RR), 이벤트 리스크.
${commonRules}`;

  const dayGuide = `
[역할] 너는 단타 복기 코치다. 분/시간 단위. 실행 규칙과 손절 속도를 최우선으로 본다.
[중점 평가] 즉시 손절 규칙, 과매매 신호, 수수료 고려, 추격매수 여부, 멘탈 붕괴 신호.
${commonRules}`;

  const etfGuide = `
[역할] 너는 ETF 복기 코치다. 상품 구조/추종지수/비용/리밸런싱을 본다.
[중점 평가] ETF 역할 정의, 추종전략 이해, 운용보수 인식, 리밸런싱 규칙, 핵심 리스크.
${commonRules}`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// ✅ [노선 2] 고수 비교 (20~100% 단위 수정 및 테마 분석 강화)
function getDiagnosisInstruction(expertId: string) {
  const expertData: Record<string, string> = {
    warren_buffett: "정보기술 45%, 금융 30%, 소비재 15%, 에너지 10% (가치/현금흐름 중심)",
    nancy_pelosi: "정보기술/반도체 70%, 성장주 30% (정책 수혜/빅테크 중심)",
    cathie_wood: "혁신기술/AI/우주 80%, 바이오 20% (파괴적 혁신/고위험 중심)",
    ray_dalio: "자산별 균등 배분, 원자재, 채권 포함 (리스크 헤지/올웨더 전략)",
    michael_burry: "경기순환주, 방어주, 저평가 가치주 (역발상/하락 배팅 중심)",
    korean_top1: "국내 반도체 대장주 50%, 주도 성장주(이차전지 등) 50% (시장 주도권 중심)"
  };

  return `
너는 '자산 배분 감사관'이다. 사용자의 포트폴리오를 선택된 고수의 데이터와 포괄적으로 대조하라.
[선택된 고수 데이터]
${expertData[expertId] || expertData.warren_buffett}

위 비중 데이터와 사용자의 비중을 포괄적으로 대조하여 얼마나 차이가 나는지 분석하라.
최대한 큰 테마(기술주, 전통주 등)로 묶어서 분석하라.
첫 줄에 반드시 "HEALTH_SCORE: [숫자]%" (범위: 20~100%)를 적고, 직접적 매수/매도 제안은 금지한다.
`.trim();
}

// ✅ [노선 3] 심층 지표 분석 (비유 리포트 형식)
function getAnalysisInstruction() {
  return `
너는 '지표 분석 애널리스트'다. 아래 형식을 하나도 틀리지 말고 복사해서 빈칸만 채워라.
[출력 형식]
## 🌐 산업 사이클 분석
---
## 🥐 붕어빵 기계로 이해하는 PER
(진단)
---
## 🏠 내 집 마련으로 이해하는 PBR
(진단)
---
## ☕ 커피숍 이익률로 이해하는 ROE
(진단)
---
## 🛍️ 시장 가판대 매출로 이해하는 PSR
(진단)
---
## 🎯 종합 결론
`.trim();
}

function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

export async function POST(req: Request) {
  try {
    const textBody = await req.text();
    const body = textBody ? JSON.parse(textBody) : null;
    if (!body) return jsonResponse({ ok: false, text: "데이터 없음" }, 400);

    const apiKey = process.env.OPENAI_API_KEY;
    let systemPrompt = "";
    let userPrompt = "";

    if (body.type === "diagnosis" || body.type === "comparison") {
      systemPrompt = getDiagnosisInstruction(body.expertId);
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 고수와 비교 분석 리포트를 작성하라.`;
    } else if (body.manualPer !== undefined) {
      systemPrompt = getAnalysisInstruction();
      userPrompt = `종목: ${body.ticker}, PER: ${body.manualPer}, ROE: ${body.manualRoe}, PBR: ${body.manualPbr}, PSR: ${body.manualPsr}. 분석 리포트 완성하라.`;
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
        temperature: 0.3,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content || "";

    // 🚨 [핵심 수정] % 단위를 포함한 숫자 추출 로직 강화
    let matchRate = 20; // 최소 점수 20점 기본값 설정
    const scoreMatch = text.match(/HEALTH_SCORE[:\s]*(\d+)/i);
    if (scoreMatch) {
      matchRate = parseInt(scoreMatch[1]);
      // % 기호가 본문에 남아있지 않도록 정규표현식으로 줄 전체 삭제
      text = text.replace(/HEALTH_SCORE[:\s]*\d+[%]?/gi, "").trim();
    }
    
    // 점수 범위 강제 (20~100)
    matchRate = Math.max(20, Math.min(100, matchRate));

    return jsonResponse({ ok: true, text, matchRate });
  } catch (e: any) {
    return jsonResponse({ ok: false, text: "서버 오류" }, 500);
  }
}