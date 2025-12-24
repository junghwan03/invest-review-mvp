import { NextResponse } from "next/server";

type TradeType = "long" | "swing" | "day";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day") return v;
  return "long";
}

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
  - 장기투자 / 스윙 / 단타
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

  if (tradeType === "long") return longGuide;
  if (tradeType === "swing") return swingGuide;
  return dayGuide;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tickerRaw = body?.ticker ?? "";
    const entryPrice = body?.entryPrice ?? "";
    const reasonNote = body?.reasonNote ?? "";
    const tradeType = normalizeTradeType(body?.tradeType);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { text: "OPENAI_API_KEY가 없습니다. (Vercel Env 확인 필요)" },
        { status: 500 }
      );
    }

    const instruction = getInstruction(tradeType);

    const userContext = `
[매매유형] ${tradeType}
[종목] ${String(tickerRaw).toUpperCase()}
[진입가] ${entryPrice}
[메모]
${reasonNote}
`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: instruction.trim() },
          { role: "user", content: userContext.trim() },
        ],
      }),
    });

    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!res.ok) {
      const msg = data?.error?.message ?? raw;
      return NextResponse.json(
        { text: `OpenAI 에러 (${res.status}): ${msg}` },
        { status: 500 }
      );
    }

    const text = data?.choices?.[0]?.message?.content ?? "응답 없음";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { text: `서버 오류: ${String(e?.message ?? e)}` },
      { status: 500 }
    );
  }
}
