// app/constants.ts

// ✅ 타입 정의 (page.tsx와 공유하기 위해 여기서 정의)
export type AssetType = "stock" | "coin";
export type TradeType = "long" | "swing" | "day" | "etf";

export type ChecklistItem = { id: string; text: string; checked: boolean };

export type Preset = {
  id: string;
  createdAt: number;
  name: string;
  tradeType: TradeType;
  ticker: string;
  entryPrice: number;
  stopLoss: number | null;
  reasonNote: string;
  checklistTexts: string[];
};

export type HistoryItem = {
  id: string;
  createdAt: number;
  tradeType: TradeType;
  ticker: string;
  entryPrice: number;
  stopLoss: number | null;
  reasonNote: string;
  result: string;
  checklist?: ChecklistItem[];
};

// ✅ 화면에 표시될 텍스트들
export const ASSET_LABEL: Record<AssetType, string> = {
  stock: "주식",
  coin: "코인",
};

export const TAB_LABEL: Record<TradeType, string> = {
  long: "장기 투자",
  swing: "스윙",
  day: "단타",
  etf: "ETF",
};

export const NOTE_TEMPLATES: Record<TradeType, string> = {
  long: `아래 질문에 답하듯 자세히 적어주세요. (장기/가치투자)

1) 기업/산업 이해: 이 회사를 왜 믿나? 제품/경쟁우위(해자)는?
2) 밸류에이션: PER/PBR/PS(대략이라도)와 “싸다고 판단한 근거”
3) 재무/안정성: 부채비율/현금흐름/이자보상배율 등 리스크 체크
4) 매수 논리(Thesis): 2~3년 관점에서 기대 시나리오
5) Thesis break(손절 기준): 어떤 일이 생기면 생각을 바꿀 건지(숫자/조건)
6) 분할매수/추가매수 계획: 어떤 가격/조건에서 얼마를 더 살지`,

  swing: `아래 질문에 답하듯 자세히 적어주세요. (스윙)

1) 트리거: 어디서 무엇(패턴/뉴스/수급) 보고 들어감?
2) 진입 기준: 지지/저항/추세/거래량 중 무엇이 핵심?
3) 손절 기준: ‘가격/조건’으로 명확히 (예: 지지 이탈 or -3%)
4) 익절/분할익절: 목표가/구간, 손익비(RR) 계산
5) 보유 기간/이벤트 리스크: 실적/발표/매크로 변수 체크했나?
6) 대안: 같은 자금이면 더 좋은 자리/종목이 있었나?`,

  day: `아래 질문에 답하듯 자세히 적어주세요. (단타)

1) 진입 근거: 체결강도/거래량/호가/모멘텀 등 ‘딱 한 문장’ 요약
2) 손절 규칙: 즉시 손절 조건(틱/퍼센트/레벨) + 최대 손실 한도
3) 익절 규칙: 목표 구간/분할익절/트레일링 여부
4) 실행 점검: 계획대로 했나? (늦진입/추격/충동 진입 여부)
5) 과매매/멘탈: 조급/복수매매 신호 있었나?
6) 다음 액션: 다음엔 뭐 하나만 바꿀 건지(1개만)`,

  etf: `아래 질문에 답하듯 자세히 적어주세요. (ETF)

1) ETF 역할: 코어/방어/성장/배당/섹터/레버리지 중 “이 ETF의 역할”은?
2) 추종 지수/전략: 무엇을 따라가나? (예: S&P500 / 나스닥100 / 커버드콜 등)
3) 비용/구조: 총보수(TER), 추적오차, 환헤지 여부, 분배금 구조는?
4) 매수 기준: 정기적립/조정 시/지표 기준 등 “룰”을 적기
5) 리밸런싱 규칙: 비중이 흔들리면 언제/어떻게 조정?
6) 정리 기준: 언제 정리할 건지(기간/조건/룰)`,
};

export const EXAMPLE_NOTES: Record<TradeType, string> = {
  long: `예시(장기):
- 산업/해자: 2위 사업자지만 단가/브랜드로 재구매율 높음
- 밸류: PER 14, PBR 1.6 수준 → 과거 밴드 하단이라 판단
- 재무: 부채비율 80%, FCF 흑자 유지
- Thesis: 2년 내 신제품+해외 확장으로 매출 CAGR 15% 기대
- Break: FCF 2분기 연속 적자 or 핵심 시장 점유율 -3%p`,
  swing: `예시(스윙):
- 트리거: 20일선 지지 + 거래량 2배 + 저항(52,000) 돌파 시도
- 진입: 52,200 돌파 확인 후 1/2 진입
- 손절: 51,200 이탈 시 전량(-2.0%)
- 익절: 54,000 1차, 56,000 2차 / RR 약 1:2
- 이벤트: 내일 CPI 발표 → 포지션 사이즈 50%로 제한`,
  day: `예시(단타):
- 근거: 장 시작 10분 고가 돌파 + 체결강도 180% + 호가 얇음
- 손절: 진입가 -0.7% 또는 직전 저점 이탈 즉시 컷
- 익절: +1.2% 1차, +2.0% 2차 / 트레일링 0.5%
- 금지: 재진입 1회까지만, 복수매매 금지
- 체크: 수수료/슬리피지 포함 손익 확인`,
  etf: `예시(ETF):
- 역할: 코어(장기 적립), 시장 평균 수익률 추구
- 전략: S&P 500 추종 / 환노출(달러) 감수
- 비용: 총보수 낮은 편, 추적오차 작음
- 매수: 매달 1회 정기매수 + -7% 조정 시 1회 추가
- 리밸: 분기 1회, 목표 비중에서 ±5% 벗어나면 조정
- 정리: 목표 변경 또는 장기 하락 추세 전환(예: 200일선 이탈 2개월 유지)`,
};

export const BOARDING_TITLE = "시작하기 전에 (중요)";
export const BOARDING_BULLETS = [
  "※ 본 서비스는 현재 베타(MVP) 단계로, 향후 기능 변경 또는 서비스 종료 가능성이 있습니다.",
  "이 리포트는 투자 조언/추천이 아니라, ‘내 매매 기록’을 구조화하는 도구입니다.",
  "숫자(진입가/손절/목표) + 판단 기준(시나리오가 깨지는 조건)을 적을수록 AI 품질이 좋아집니다.",
  "AI 결과는 참고용이며, 최종 판단과 책임은 본인에게 있습니다.",
];