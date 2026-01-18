import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TradeType = "long" | "swing" | "day" | "etf";

function normalizeTradeType(v: any): TradeType {
  if (v === "long" || v === "swing" || v === "day" || v === "etf") return v;
  return "long";
}

// =========================================================
// 📝 [기록 보존] 매매 복기용 가이드라인 (절대 삭제/생략 금지)
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
단타/차트 얘기는 최소화하고 장기 자산배분 관점으로 지도한다.

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
// 🛠️ [기존 코드 유지] 헬퍼 함수들
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

async function parseOpenAIResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!raw || !raw.trim()) return { raw: "", data: null as any };
  if (contentType.includes("application/json")) {
    try {
      return { raw, data: JSON.parse(raw) };
    } catch {
      return { raw, data: null as any };
    }
  }
  return { raw, data: null as any };
}

// ✅ 숫자 파싱(문자열/number 모두 허용), 실패하면 null
function parseNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ✅ “입력가”를 텍스트에 고정해서 박는 메타 라인
function prependFixedPriceMeta(text: string, ticker: string, inputPrice: number) {
  const meta = `입력 가격 $${inputPrice} 기준 분석 결과 (${ticker})`;
  const trimmed = (text ?? "").trim();
  if (!trimmed) return meta;
  if (trimmed.includes(`$${inputPrice}`) && trimmed.includes("입력 가격")) return trimmed;
  return `${meta}\n\n${trimmed}`;
}

// ✅ 모델이 혹시라도 다른 가격을 만들어 쓰면 서버가 제거/치환
function enforcePriceInText(text: string, inputPrice: number) {
  const fixed = `$${inputPrice}`;

  let t = (text ?? "").trim();

  // 1) 달러 가격 패턴을 전부 찾아서 "입력 가격"으로 바꿈
  //    (모델이 $437.5 같은 걸 박는 경우 강제 제거)
  t = t.replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, "입력 가격");

  // 2) 혹시 "437.5달러" 같이 달러기호 없이도 쓰면 제거(너무 공격적이지 않게 '달러' 붙은 경우만)
  t = t.replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*달러\b/g, "입력 가격");

  // 3) 최상단에만 서버가 고정 가격 메타를 넣는다
  //    (본문에서는 '입력 가격'이라고만 나오게 해서 변형 자체를 못 하게 함)
  //    => 네 요구: "내가 입력한 가격으로 나오게"는 메타 라인에서 보장
  //       본문은 가격 대신 '입력 가격'으로 표기
  if (!t.startsWith("입력 가격")) {
    t = `입력 가격 ${fixed} 기준 분석 결과\n\n${t}`;
  } else {
    // 이미 시작이 입력 가격이면, 그래도 숫자까지 고정해서 1줄로 정리
    const lines = t.split("\n");
    lines[0] = `입력 가격 ${fixed} 기준 분석 결과`;
    t = lines.join("\n");
  }

  return t;
}

// =========================================================
// 🚀 POST
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

    // --- [분기 1] 비전 분석 ---
    if (body.type === "vision" && body.imageBase64) {
      model = "gpt-4o";
      temp = 0;
      systemPrompt = "주식 데이터 추출 전문가. JSON으로만 응답하라.";
      userPrompt = [
        { type: "text", text: "이미지에서 ticker, price, per, roe, pbr, psr, weight(비중%) 추출." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` } },
      ];
    }
    // --- [분기 2] 비교 분석 ---
    else if (body.type === "comparison") {
      const experts: any = {
        warren_buffett: "워런 버핏",
        nancy_pelosi: "낸시 펠로시",
        cathie_wood: "캐시 우드",
        ray_dalio: "레이 달리오",
        michael_burry: "마이클 버리",
        korean_top1: "한국 1% 고수",
      };
      systemPrompt = `너는 ${experts[body.expertId] || "투자 고수"}다. 사용자의 포트폴리오를 냉철하게 분석하라.`;
      userPrompt = `내 포트폴리오: ${JSON.stringify(body.portfolio)}. 분석 및 조언을 작성하라.`;
      temp = 0.35;
    }
    // --- [분기 3] 매매 복기 ---
    else if (body.tradeType) {
      const tradeType = normalizeTradeType(body.tradeType);
      systemPrompt = getInstruction(tradeType);
      userPrompt = `
[매매유형] ${tradeType}
[종목] ${String(body.ticker ?? "").toUpperCase()}
[진입가] ${body.entryPrice ?? ""}
[손절가] ${body.stopLoss ?? "N/A"}
[메모]
${body.reasonNote ?? ""}
      `.trim();
    }
    // --- [분기 4] 종목 심층 분석 (입력 가격 절대 고정 + 서버 후처리로 강제) ---
    else {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();

      // ✅ currentPrice 강제 파싱 + 유효성 검사
      const inputPriceNum = parseNumberOrNull(body.currentPrice);
      if (inputPriceNum === null) {
        return jsonResponse(
          { ok: false, text: "currentPrice(현재가)가 비어있거나 숫자가 아닙니다. 예: 436 또는 '436' 형태로 보내주세요." },
          400
        );
      }

      const manualPer = body.manualPer ?? "N/A";
      const manualRoe = body.manualRoe ?? "N/A";
      const manualPbr = body.manualPbr ?? "N/A";
      const manualPsr = body.manualPsr ?? "N/A";

      temp = 0;

      // ✅ 핵심: 모델이 가격 숫자를 “본문에 쓰지 못하게” 금지
      //    (가격은 서버가 메타로만 보여줌)
      systemPrompt = `
너는 월가 출신의 수석 애널리스트다.

[🚨 입력값 절대 고정 규칙]
- "입력 가격" 숫자(달러 금액)를 본문에 직접 쓰지 마라.
- 본문에서 가격을 언급할 때는 항상 "입력 가격"이라고만 표현하라.
- 새로운 가격을 추정/반올림/소수점 추가로 만들어 쓰는 행위는 금지.

[출력 시작 형식(고정)]
- 첫 줄은 반드시 아래 문장으로 시작:
"입력 가격 $${inputPriceNum} 기준 분석 결과 (${ticker})"

[행동 제한]
- 직접적인 매수/매도/수익실현/분할매수 같은 행동 지시는 금지.
- 분석/리스크/체크포인트 중심으로 작성.

[데이터]
- 종목: ${ticker}
- 입력 가격: $${inputPriceNum}
- 지표: PER ${manualPer}, ROE ${manualRoe}, PBR ${manualPbr}, PSR ${manualPsr}
      `.trim();

      userPrompt = `
종목: ${ticker}
입력 가격(절대 고정): $${inputPriceNum}
지표: PER ${manualPer}, ROE ${manualRoe}, PBR ${manualPbr}, PSR ${manualPsr}

요구사항:
1) 첫 줄은 반드시 "입력 가격 $${inputPriceNum} 기준 분석 결과 (${ticker})"
2) 본문에서 가격을 언급할 때는 숫자 대신 "입력 가격"이라고만 쓸 것
3) 지표가 N/A면 N/A로 표시하고, 대신 체크포인트/리스크를 구조화해서 제시
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
    if (!res.ok) {
      const msg = data?.error?.message || raw?.slice(0, 400) || "오류";
      return jsonResponse({ ok: false, text: `API 에러: ${msg}` }, 500);
    }

    let text = data?.choices?.[0]?.message?.content ?? "";

    // ✅ 심층분석 분기에서만: 서버가 가격을 강제 고정 + 모델이 만든 가격 전부 제거/치환
    if (!body.type && !body.tradeType) {
      const ticker = String(body.ticker || "UNKNOWN").toUpperCase();
      const inputPriceNum = parseNumberOrNull(body.currentPrice);
      if (inputPriceNum !== null) {
        // (1) 혹시 모델이 첫 줄을 빼먹어도 메타 강제 추가
        text = prependFixedPriceMeta(text, ticker, inputPriceNum);
        // (2) 본문 내 임의 가격 제거 + 메타 라인 가격 강제 고정
        text = enforcePriceInText(text, inputPriceNum);
      }
    }

    return jsonResponse({ ok: true, text, content: text }, 200);
  } catch (e: any) {
    return jsonResponse({ ok: false, text: `서버 오류: ${String(e?.message ?? e)}` }, 500);
  }
}
