import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// ✅ 오픈AI 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// =========================================================
// 📝 [기록 보존] 매매 복기용 가이드라인 (절대 삭제 금지)
// =========================================================
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
- 2) 점수(각 항목 0~10점) + 한줄 근거  (반드시 N/10점 형식)
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
[역할]
너는 장기/가치투자 복기 코치다. 단타/차트 얘기를 줄이고, 펀더멘털/가치/리스크를 본다.
[중점 평가(장기 전용)]
- 기업의 해자/경쟁우위/산업 포지션 언급 여부
- 밸류에이션: PER/PBR/PS/FCF 중 최소 1개라도 "기준 숫자"가 있는지
- 재무 안전성: 부채비율/현금흐름/이자보상배율 같은 리스크 체크가 있는지
- 장기 시나리오: 1~3년 관점의 촉매/성장 가정이 있는지
- Thesis break(생각 바뀌는 조건): '무슨 일이면 틀렸다고 인정할지' 명확한지
[체크리스트는 장기 전용으로만]
예) 밸류에이션 기준, 재무 리스크, 경쟁우위, 가정/리스크, thesis break
[매매 유형 분류는 반드시 "장기투자"]
${commonRules}
`;

  const swingGuide = `
[역할]
너는 스윙 트레이딩 복기 코치다. 며칠~몇 주 관점. 진입/손절/익절의 '숫자 기준'을 가장 중요하게 본다.
[중점 평가(스윙 전용)]
- 진입 트리거(패턴/뉴스/수급 등)가 한 문장으로 명확한지
- 손절 기준이 숫자(%, 가격, 레벨)로 명확한지
- 익절/분할익절 기준이 있는지
- 손익비(RR) 의식이 있는지
- 이벤트 리스크(실적/발표/매크로)를 고려했는지
- 감정 개입(추격매수/물타기/계획 변경) 흔적
[체크리스트는 스윙 전용으로만]
예) 트리거, 손절 숫자, 익절/분할, RR, 이벤트 캘린더
[매매 유형 분류는 반드시 "스윙"]
${commonRules}
`;

  const dayGuide = `
[역할]
너는 단타 복기 코치다. 분/시간 단위. 실행 규칙과 손절 속도를 최우선으로 본다.
[중점 평가(단타 전용)]
- 즉시 손절 규칙(틱/퍼센트/레벨)이 있는지
- 과매매/복수매매 신호가 있는지
- 수수료/슬리피지 고려가 있는지
- 진입이 추격인지(늦진입) 여부
- 멘탈 붕괴 신호(조급/흥분/공포) 체크
- 계획 대비 실행 일치(원칙 위반 여부)
[체크리스트는 단타 전용으로만]
예) 손절 트리거, 1회 최대손실, 재진입 금지 조건, 체결/호가 확인, 감정 체크
[매매 유형 분류는 반드시 "단타"]
${commonRules}
`;

  const etfGuide = `
[역할]
너는 ETF 복기 코치다. 개별 종목 분석보다 "상품 구조/추종지수/비용/분배금/리밸런싱/포트 역할"을 본다.
[중점 평가(ETF 전용)]
- ETF의 역할: 코어/위성/배당/방어/성장/헤지 중 무엇인지 1문장으로 정의했는가?
- 추종지수/전략: S&P500/나스닥/커버드콜/팩터/리츠/채권/레버리지/인버스 등 구조 이해가 있는가?
- 비용: 총보수(TER) 또는 운용보수 인식이 있는가? “싸다/비싸다” 기준이 있는가?
- 분배금: 기대한다면 분배금 변동성/재투자(재매수) 계획이 있는가?
- 리밸런싱 규칙: 추가매수 조건(가격/비중/주기) + 중단 조건(전략이 깨지는 조건)이 있는가?
- 리스크: 레버리지/환율/금리/섹터 편중 등 핵심 리스크를 1~2개라도 적었는가?
[체크리스트는 ETF 전용으로만]
예) 역할 정의, 지수/전략, 비용, 분배금/재투자, 리밸런싱/중단조건, 핵심 리스크
[매매 유형 분류는 반드시 "ETF"]
${commonRules}
`;

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  if (tradeType === "day") return dayGuide;
  return etfGuide;
}

// =========================================================
// 🛠️ 헬퍼 함수들 (절대 삭제 금지)
// =========================================================
function jsonResponse(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    },
  });
}

async function safeReadJson(req: Request) {
  try {
    const text = await req.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// =========================================================
// 🚀 POST 함수: 매매 복기 + 심층 분석 통합 로직
// =========================================================
export async function POST(req: Request) {
  try {
    const body = await safeReadJson(req);
    if (!body) return jsonResponse({ ok: false, text: "데이터가 없습니다." }, 400);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ ok: false, text: "API Key 미설정" }, 500);

    // --- [분기 1] 매매 복기 (Trade Review) ---
    // tradeType이 있고, type이 없는 경우 매매 복기로 판단
    if (body.tradeType && !body.type) {
      const tradeType = normalizeTradeType(body.tradeType);
      const instruction = getInstruction(tradeType);
      const userContext = `
        [매매유형] ${tradeType}
        [종목] ${String(body.ticker || "").toUpperCase()}
        [진입가] ${body.entryPrice || ""}
        [손절가] ${body.stopLoss || "N/A"}
        [메모] ${body.reasonNote || "(없음)"}
      `.trim();

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: instruction.trim() },
          { role: "user", content: userContext },
        ],
        temperature: 0.35,
      });

      return jsonResponse({ ok: true, text: res.choices[0].message.content }, 200);
    }

    // --- [분기 2] 비전 분석 (Screenshot Extraction) ---
    if (body.type === "vision" && body.imageBase64) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "주식 데이터 추출 전문가. JSON만 출력하라." },
          {
            role: "user",
            content: [
              { type: "text", text: "이 이미지에서 ticker, price, per, roe, pbr, psr, weight(포트비중%)를 추출해서 JSON으로 줘." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } }
            ],
          },
        ],
        response_format: { type: "json_object" },
      });
      return jsonResponse({ ok: true, content: response.choices[0].message.content });
    }

    // --- [분기 3] 고수 비교 분석 (Comparison) ---
    if (body.type === "comparison") {
      const experts: any = {
        warren_buffett: "워런 버핏", nancy_pelosi: "낸시 펠로시", cathie_wood: "캐시 우드",
        ray_dalio: "레이 달리오", michael_burry: "마이클 버리", korean_top1: "한국 1% 고수"
      };
      const expertName = experts[body.expertId] || "투자 고수";
      const portStr = body.portfolio?.map((p: any) => `${p.ticker}(${p.weight}%)`).join(", ");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `너는 ${expertName}다. 사용자의 포트폴리오를 네 철학에 맞춰 냉철하게 분석하라.` },
          { role: "user", content: `내 포트폴리오: ${portStr}. 분석해줘.` },
        ],
      });
      return jsonResponse({ ok: true, content: response.choices[0].message.content });
    }

    // --- [분기 4] 종목 심층 분석 (Single Stock Upgrade) ---
    const ticker = body.ticker || "UNKNOWN";
    const currentPrice = body.currentPrice || "N/A";
    const info = `PER:${body.manualPer}, ROE:${body.manualRoe}, PBR:${body.manualPbr}, PSR:${body.manualPsr}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "월가 수석 애널리스트. 투자 매력도와 리스크를 상세히 분석하라." },
        { role: "user", content: `종목: ${ticker}, 가격: ${currentPrice}, 지표: ${info}. 심층 분석 리포트를 작성하라.` },
      ],
    });

    return jsonResponse({ ok: true, content: response.choices[0].message.content });

  } catch (e: any) {
    console.error("Server Error:", e);
    return jsonResponse({ ok: false, text: `서버 오류: ${e.message}` }, 500);
  }
}