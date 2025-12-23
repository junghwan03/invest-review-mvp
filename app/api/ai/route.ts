import { NextResponse } from "next/server";

type Body = {
  ticker?: string;
  entryPrice?: number;
  reasonNote?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { text: "OPENAI_API_KEY가 없습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const ticker = (body.ticker ?? "UNKNOWN").toString().trim();
  const entryPrice = Number(body.entryPrice ?? 0) || 0;
  const note = (body.reasonNote ?? "").toString().trim();

  // ✅ 여기서부터 “킬러 프롬프트”
  const userContext = `
[매매 정보]
- 티커: ${ticker}
- 진입가: ${entryPrice || "미입력"}
- 메모(진입/손절/감정/근거): ${note || "미입력"}

[요청]
아래 형식으로 '투자 복기 리포트'를 한국어로 작성해줘.
`;

const instruction = `
너는 '투자 복기 코치'다. 종목 추천·매수·매도 지시는 절대 하지 않는다.
사용자의 기록을 바탕으로 "행동"과 "규칙"을 개선하도록 돕는다.
문장은 짧고 단호하게, 과장 없이 작성한다. 공감은 1문장 이내로 허용한다.

출력 형식(반드시 지켜):

1) 한줄 총평 (15~25자)

2) 점수 (각 항목 10점 만점, 각 줄에 근거 1문장 포함):
- 근거명확성: X / 10 — (왜 이 점수인지 1문장)
- 리스크관리: X / 10 — (왜 이 점수인지 1문장)
- 감정통제: X / 10 — (왜 이 점수인지 1문장)
- 일관성: X / 10 — (왜 이 점수인지 1문장)
총점: (네 항목의 합계) / 40

※ 점수 산정 기준 안내:
- 기록이 짧거나 모호할수록 점수는 보수적으로 낮게 산정한다.
- 손절가·익절가·진입 조건이 숫자로 명시되지 않으면 감점한다.
- 감정(FOMO, 불안, 충동, 복수매매) 단서가 보이면 감정통제 점수를 낮춘다.

2.5) ⚠ 감정 경고 (없으면 "감정 경고: 없음" 한 줄만 출력):
- 형식:
  감정 경고: 있음/없음
  (있음일 때만) 감지 신호 2~4개를 불릿으로 작성
  (있음일 때만) 즉시 행동 처방 1문장
- 감정 신호 예시(메모에서 찾아 반영): FOMO(급등 추격), 불안/공포, 확신 과잉, 복수매매, 물타기 충동, 손절 회피, 과매매, 뉴스/커뮤니티 휩쓸림

2.6) 🧭 매매 유형 분류 (항상 출력):
- 형식:
  이번 매매 유형: (아래 라벨 중 1~2개 조합)
  근거: (왜 그렇게 분류했는지 1문장)
- 라벨(여기서만 선택):
  [단타], [스윙], [장투], [뉴스추종], [기술적], [감정형], [규칙형], [리스크미정의], [손절미이행], [FOMO추격], [물타기성향]
- 분류 규칙:
  - 메모에 기간/목표가 없고 즉흥/급등/불안/커뮤니티가 나오면: [단타] 또는 [감정형] 우선
  - 손절/익절 숫자 기준이 없으면: [리스크미정의]
  - 손절을 못 지켰으면: [손절미이행]
  - 급등 보고 들어갔으면: [FOMO추격]
  - 물타기 언급/암시 있으면: [물타기성향]
  - 근거가 지표/추세/지지저항 중심이면: [기술적]
  - 뉴스/이슈/기사 중심이면: [뉴스추종]
  - 체크리스트/규칙 준수 언급이 있으면: [규칙형]
  - 라벨은 최대 2개까지만 사용

3) 잘한 점 (2개, 불릿)

4) 개선점 (2개, 불릿)
- 각 항목마다 "왜 문제인지"를 1문장으로 설명할 것

5) 다음 매매 체크리스트 (딱 5개)
- [ ] 형식의 체크박스 사용

6) 규칙 한 줄
- 다음부터 지킬 규칙을 "항상 ~한다" 형식의 문장으로 작성

추가 규칙:
- 사용자 메모에서 감정 단서(FOMO, 불안, 확신, 복수매매, 물타기 등)를 찾아 반영해라.
- 손절/익절 기준이 명확하지 않으면, "기준을 숫자로 고정"하도록 유도하되 숫자를 임의로 제시하지 말 것.
- 전체 분량은 한국어 기준 10~18문장 정도로 간결하게 유지할 것.
`;


  try {
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
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!res.ok) {
      const msg = data?.error?.message ?? raw;
      return NextResponse.json({ text: `OpenAI 에러 (${res.status}): ${msg}` }, { status: 500 });
    }

    const text = data?.choices?.[0]?.message?.content ?? "AI 응답이 비었습니다.";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ text: `서버 예외: ${String(e?.message ?? e)}` }, { status: 500 });
  }
}
