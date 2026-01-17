import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

// 🌐 [CORS 설정] 토스 앱에서 Vercel 백엔드로 접속할 수 있게 허용하는 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 모든 도메인 허용 (토스 미니앱 환경 대응)
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 🛡️ [OPTIONS 처리] 브라우저의 사전 보안 점검(Preflight) 요청 대응
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 🏆 [1. 횟수 제한 설정 - 매매 복기와 동일하게 일일 3회]
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

// 🏆 [3. 마스터 데이터베이스: 6인의 고수 포트폴리오]
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

    // --- 5. 일일 사용 횟수 제한 체크 ---
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

    // --- 6. 모드별 분석 로직 분기 ---

    // 📸 [추가] 모드 C: 스크린샷 이미지 분석 (Vision)
    if (type === "vision" && imageBase64) {
      systemMsg = "너는 주식 앱 스크린샷 전문 데이터 분석가다. 이미지에서 투자 정보를 추출해라.";
      userPrompt = [
        {
          type: "text",
          text: `이 이미지(주식 계좌 또는 종목 상세 화면)에서 다음 데이터를 추출하여 JSON 형식으로만 응답해라:
          1. 종목명(또는 티커)
          2. 비중(%) - 계좌 화면인 경우
          3. PER, ROE, PBR, PSR 수치 - 종목 상세 화면인 경우
          
          [주의] 
          - 데이터가 없는 항목은 "N/A"로 채울 것.
          - 오직 JSON 객체(또는 리스트)만 반환할 것. 다른 텍스트는 금지한다.
          - 형식: { "extracted": [ { "ticker": "...", "weight": "...", "per": "...", "roe": "...", "pbr": "...", "psr": "..." } ] }`
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
      systemMsg = "너는 세계적인 자산 운용가이자 투자 성향 분석가다. 냉철하고 전문적인 톤을 유지해라. 투자 제안(매수/매도)을 절대 하지 말고 데이터 기반의 상태 분석만 제공해라.";
      userPrompt = `
      사용자의 포트폴리오를 고수 '${expert.name}'의 전략과 비교 분석해라.
      
      [데이터]
      - 사용자 포트폴리오: ${JSON.stringify(portfolio)}
      - 고수(${expert.name}) 섹터 비중: ${JSON.stringify(expert.sectors)}
      - 고수 전략 설명: ${expert.description}
      
      [분석 가이드 및 규칙]
      1. 리포트 최상단에 이 사용자의 투자 스타일을 8자 내외의 멋진 수식어로 정의해라. (예: "냉철한 가치투자자", "공격적 성장주 사냥꾼")
      2. 답변 본문은 "### 📊 포트폴리오 진단 결과"로 시작해라.
      3. 사용자의 종목들을 섹터별로 분류하여 비중을 계산하고 고수의 비중과 대조해라.
      4. 어느 부분이 과잉이고 부족한지, 고수의 철학에 비추어 볼 때 보완해야 할 점을 조언해라.
      `;
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
      
      systemMsg = "너는 대한민국 최고의 퀀트 분석가다. 냉철하고 전문적인 수석 분석가 톤을 유지해라. 오직 시장의 객관적 상태와 데이터 분석만 제공하고 직접적인 투자 행동 제안은 절대 하지 마라.";
      userPrompt = `
      [실시간 데이터]
      - 종목명: ${live?.name || userInput}
      - 현재가: ${live?.price} ${live?.currency}
      - 지표: PER ${finalData.per}배 | ROE ${finalData.roe}% | PBR ${finalData.pbr}배 | PSR ${finalData.psr}배
      
      [출력 규칙]
      1. 답변 최상단은 반드시 "### 📈 ${live?.name || userInput} | 현재가: ${live?.price} ${live?.currency}" 형식으로 한 줄 출력해라.
      2. 그 아래에 "**PER**: ${finalData.per}배 | **ROE**: ${finalData.roe}% | **PBR**: ${finalData.pbr}배 | **PSR**: ${finalData.psr}배"를 출력해라.
      3. **'## 🌐 산업 사이클 분석'** 섹션을 반드시 포함하여 현재 어느 단계(도입-성장-성숙-쇠퇴)인지 분석해라.
      4. **'## 🎯 종합 결론'**과 **'## 🔍 상세 지표 분석'**을 작성해라.
      5. 절대 표(Table) 형식을 사용하지 마라.
      `;
    }

    // --- 7. OpenAI API 호출 ---
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", 
        messages: [{ role: "system", content: systemMsg }, { role: "user", content: userPrompt }],
        max_tokens: 1000,
      }),
    });

    const data = await res.json();
    
    // 호출 성공 시 카운트 증가
    USAGE_STORE[ip].count += 1;

    // --- 8. Page.tsx와 완벽 호환되는 데이터 반환 (CORS 헤더 포함) ---
    return NextResponse.json({ 
      content: data.choices[0].message.content,
      remaining: DAILY_FREE_LIMIT - USAGE_STORE[ip].count 
    }, { headers: corsHeaders });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}