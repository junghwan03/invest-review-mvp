import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

// 🌐 [보강] 토스 미니앱 인프라 대응 강력한 CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400", // 사전 점검 결과를 하루 동안 유지하여 간헐적 차단 방지
};

// 🛡️ [최적화] 사전 보안 점검 응답 속도 극대화
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// 🏆 [1. 횟수 제한 설정]
const DAILY_FREE_LIMIT = 3;
const USAGE_STORE: Record<string, { count: number; lastReset: string }> = {};

// 🏆 [2. 마스터 데이터베이스: 종목 지표]
const MASTER_FUNDAMENTALS: Record<string, any> = {
  "TSLA.O": { per: 276.9, roe: 7.2, pbr: 21.4, psr: 10.5, cap: "1.46T USD" },
  "AAPL.O": { per: 34.6, roe: 160.0, pbr: 52.1, psr: 9.8, cap: "3.8T USD" },
  "NVDA.O": { per: 68.2, roe: 115.5, pbr: 58.4, psr: 32.1, cap: "3.4T USD" },
  "005930": { per: 10.75, roe: 9.03, pbr: 1.15, psr: 1.25, cap: "972T KRW" },
  "000660": { per: 15.2, roe: 12.5, pbr: 1.85, psr: 2.1, cap: "140T KRW" }
};

// 🏆 [3. 마스터 데이터베이스: 고수 포트폴리오]
const EXPERT_PORTFOLIOS: Record<string, any> = {
  "warren_buffett": {
    name: "워런 버핏 (가치투자)",
    sectors: { "정보기술": 45, "금융": 30, "소비재": 15, "에너지": 10 },
    description: "현금 흐름이 확실한 우량주 중심의 안정적 투자"
  },
  "nancy_pelosi": {
    name: "낸시 펠로시 (정치/빅테크)",
    sectors: { "정보기술": 85, "커뮤니케이션": 10, "기타": 5 },
    description: "미국 정책 수혜를 받는 거대 IT 기업 집중 투자"
  },
  "cathie_wood": {
    name: "캐시 우드 (혁신성장)",
    sectors: { "파괴적혁신": 70, "헬스케어": 20, "기타": 10 },
    description: "테슬라 등 미래 파괴적 기술에 올인하는 초고성장 투자"
  },
  "ray_dalio": {
    name: "레이 달리오 (안전배분)",
    sectors: { "금/원자재": 20, "금융": 20, "정보기술": 20, "헬스케어": 20, "기타": 20 },
    description: "어떤 시장 상황에서도 버티는 올웨더 자산 배분"
  },
  "michael_burry": {
    name: "마이클 버리 (역발상)",
    sectors: { "임의소비재": 40, "금융": 30, "정보기술": 20, "기타": 10 },
    description: "남들이 보지 않는 저평가된 곳을 공략하는 숏의 대가"
  },
  "korean_top1": {
    name: "국내 수익률 1% 고수",
    sectors: { "반도체": 40, "이차전지": 30, "자동차": 20, "금융": 10 },
    description: "한국 시장 주도 섹터 중심의 빠른 순환매 전략"
  }
};

// 🛠️ [4. 실시간 주가 조회 엔진]
async function getLivePrice(ticker: string) {
  try {
    const isDomestic = /^[0-9]+$/.test(ticker);
    const symbol = isDomestic ? ticker : (ticker.includes(".") ? ticker : `${ticker}.O`);
    const url = isDomestic 
      ? `https://m.stock.naver.com/api/stock/${symbol}/basic`
      : `https://api.stock.naver.com/stock/${symbol}/basic`;

    const res = await fetch(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://m.stock.naver.com" 
      },
      cache: 'no-store'
    });

    if (!res.ok) throw new Error(`HTTP 에러! 상태코드: ${res.status}`);
    const data = await res.json();
    
    return {
      price: data.closePrice || data.dealPrice || "N/A",
      name: data.stockName || data.stockNameEng || ticker,
      currency: data.currencyType?.code || (isDomestic ? "KRW" : "USD")
    };
  } catch (e) { return null; }
}

export async function POST(req: Request) {
  try {
    const headerList = await headers();
    const ip = (headerList.get("x-forwarded-for") ?? "127.0.0.1").split(',')[0];
    const today = new Date().toISOString().split("T")[0];

    if (!USAGE_STORE[ip] || USAGE_STORE[ip].lastReset !== today) {
      USAGE_STORE[ip] = { count: 0, lastReset: today };
    }

    if (USAGE_STORE[ip].count >= DAILY_FREE_LIMIT) {
      return NextResponse.json({ 
        error: "오늘 무료 분석 횟수(3회)를 모두 사용하셨습니다. 내일 다시 이용해주세요!", 
        limitReached: true 
      }, { status: 429, headers: corsHeaders });
    }

    const body = await req.json();
    const { type, ticker, manualPer, manualRoe, manualPbr, manualPsr, portfolio, expertId, imageBase64 } = body;
    const apiKey = process.env.OPENAI_API_KEY;

    let systemMsg = "";
    let userPrompt: any = "";

    // 📸 [모드 C: 스크린샷 이미지 분석 고도화]
    if (type === "vision" && imageBase64) {
      systemMsg = `너는 증권사 앱 스크린샷 판독 전문가다. 이미지에서 지표를 추출해라. 
      [판독 가이드]
      1. '배' 또는 'x'가 붙은 숫자는 PER, PBR, PSR 수치다.
      2. '%'가 붙은 숫자는 ROE 수치다. 
      3. 숫자가 'N/A'이더라도 주변 텍스트와 레이아웃을 보고 가장 적절한 지표값을 찾아내라.
      4. 한국어 종목명과 티커를 모두 지원한다.
      5. 출력은 반드시 순수 JSON만 해라.`;

      userPrompt = [
        {
          type: "text",
          text: `이미지에서 다음 데이터를 추출하여 JSON 형식으로 응답해라:
          { "extracted": [ { "ticker": "종목명", "weight": "비중(숫자만)", "per": "PER값", "roe": "ROE값", "pbr": "PBR값", "psr": "PSR값" } ] }
          수치를 못 찾으면 "N/A" 대신 이미지 내의 가장 근접한 숫자라도 적어라.`
        },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        }
      ];
    }
    // [모드 A: 고수 포트폴리오 비교]
    else if (type === "comparison" || portfolio) {
      const expert = EXPERT_PORTFOLIOS[expertId] || EXPERT_PORTFOLIOS["warren_buffett"];
      systemMsg = "너는 세계적인 자산 운용가다. 냉철하고 전문적인 톤을 유지해라. 투자 제안이 아닌 데이터 기반 분석만 제공해라.";
      userPrompt = `사용자 포트폴리오를 고수 '${expert.name}'의 전략과 비교 분석해라.\n\n- 사용자: ${JSON.stringify(portfolio)}\n- 고수 섹터: ${JSON.stringify(expert.sectors)}\n- 전략: ${expert.description}\n\n최상단에 8자 내외 수식어로 스타일을 정의하고 '### 📊 포트폴리오 진단 결과'로 시작해라.`;
    } 
    // [모드 B: 단일 종목 심층 분석]
    else {
      const userInput = ticker?.trim().toUpperCase();
      if (!userInput) return NextResponse.json({ error: "종목명을 입력해주세요." }, { headers: corsHeaders });

      const TICKER_MAP: any = { "테슬라": "TSLA.O", "삼성전자": "005930", "엔비디아": "NVDA.O", "애플": "AAPL.O" };
      const targetCode = TICKER_MAP[userInput] || userInput;

      const live = await getLivePrice(targetCode);
      const dbFund = MASTER_FUNDAMENTALS[targetCode] || MASTER_FUNDAMENTALS[`${targetCode}.O`];
      
      const finalData = {
        per: manualPer || dbFund?.per || "N/A",
        roe: manualRoe || dbFund?.roe || "N/A",
        pbr: manualPbr || dbFund?.pbr || "N/A",
        psr: manualPsr || dbFund?.psr || "N/A"
      };
      
      systemMsg = "너는 대한민국 최고의 퀀트 분석가다. 냉철하고 전문적인 톤으로 데이터 분석만 제공해라.";
      userPrompt = `[데이터]\n종목: ${live?.name || userInput}\n현재가: ${live?.price} ${live?.currency}\n지표: PER ${finalData.per}배 | ROE ${finalData.roe}% | PBR ${finalData.pbr}배 | PSR ${finalData.psr}배\n\n'### 📈 종목명 | 현재가' 형식으로 시작하고 '## 🌐 산업 사이클 분석'과 '## 🎯 종합 결론'을 포함해라.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", 
        messages: [{ role: "system", content: systemMsg }, { role: "user", content: userPrompt }],
        max_tokens: 1000,
        temperature: 0, // 🎯 추출 정확도를 위해 일관성 극대화
      }),
    });

    const data = await res.json();
    USAGE_STORE[ip].count += 1;

    return NextResponse.json({ 
      content: data.choices[0].message.content,
      remaining: DAILY_FREE_LIMIT - USAGE_STORE[ip].count 
    }, { headers: corsHeaders });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}