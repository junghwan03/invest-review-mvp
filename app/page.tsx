"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { gaEvent, GA_EVENT } from "@/lib/ga";

type TradeType = "long" | "swing" | "day" | "etf";

const TAB_LABEL: Record<TradeType, string> = {
  long: "장기 투자",
  swing: "스윙",
  day: "단타",
  etf: "ETF",
};

const NOTE_TEMPLATES: Record<TradeType, string> = {
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

// ✅ “옆에 볼 수 있는 예시” (탭별)
const EXAMPLE_NOTES: Record<TradeType, string> = {
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

// ✅✅✅ FIX: 한글/영문/숫자/공백/.-_ 허용 (종목명/티커/코인명/ETF 검색어로 사용)
function clampTicker(v: string) {
  return v.replace(/[^\p{L}\p{N}\s.\-_]/gu, "").trim().slice(0, 40);
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ====== ✅ 히스토리(오프라인 저장) ======
const HISTORY_KEY = "invest_review_history_v2"; // ✅ v2로 올림(체크리스트 포함)
const FREE_HISTORY_LIMIT = 10;

// ====== ✅ 프리셋(규칙 세트) ======
const PRESET_KEY = "invest_rule_presets_v1";
const FREE_PRESET_LIMIT = 8;

type ChecklistItem = { id: string; text: string; checked: boolean };

type Preset = {
  id: string;
  createdAt: number;
  name: string;
  tradeType: TradeType;
  ticker: string;
  entryPrice: number;
  stopLoss: number | null;
  reasonNote: string;
  checklistTexts: string[]; // ✅ C-2: 체크리스트(규칙)까지 프리셋에 저장
};

type HistoryItem = {
  id: string;
  createdAt: number;
  tradeType: TradeType;
  ticker: string;
  entryPrice: number;
  stopLoss: number | null;
  reasonNote: string;
  result: string;
  checklist?: ChecklistItem[]; // ✅ C: 기록에도 남기고 싶으면 저장(선택)
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function short(s: string, n = 80) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// ====== ✅ 내보내기(복사) ======
function buildExportText(h: HistoryItem) {
  const label = TAB_LABEL[h.tradeType];
  const created = formatDateTime(h.createdAt);
  const sl = h.stopLoss == null ? "N/A" : String(h.stopLoss);

  const checklistBlock =
    h.checklist && h.checklist.length
      ? ["", `【규칙 체크】`, ...h.checklist.map((c) => `- ${c.checked ? "[x]" : "[ ]"} ${c.text}`)].join("\n")
      : "";

  return [
    `AI 투자 복기 리포트`,
    `- 날짜: ${created}`,
    `- 타입: ${label}`,
    `- 종목(검색어): ${h.ticker}`,
    `- 진입가: ${h.entryPrice}`,
    `- 손절가: ${sl}`,
    ``,
    `【메모】`,
    h.reasonNote?.trim() ? h.reasonNote.trim() : "(없음)",
    checklistBlock,
    ``,
    `【AI 결과】`,
    h.result?.trim() ? h.result.trim() : "(없음)",
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// ====== ✅ 무료 사용 제한(하루 2회) ======
const DAILY_LIMIT = 2;
const DAILY_LIMIT_KEY = "daily_ai_limit_v1";
type DailyUsage = { date: string; count: number };

function todayKeyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readDailyUsage(): DailyUsage {
  const today = todayKeyLocal();
  const raw = localStorage.getItem(DAILY_LIMIT_KEY);
  if (!raw) return { date: today, count: 0 };

  try {
    const parsed = JSON.parse(raw) as DailyUsage;
    if (!parsed?.date || typeof parsed.count !== "number") return { date: today, count: 0 };
    if (parsed.date !== today) return { date: today, count: 0 };
    return parsed;
  } catch {
    return { date: today, count: 0 };
  }
}

function writeDailyUsage(next: DailyUsage) {
  localStorage.setItem(DAILY_LIMIT_KEY, JSON.stringify(next));
}

/** =========================
 * ✅ A) 메모 점검 (AI 없이)
 * ========================= */
type NoteCheckItem = { label: string; ok: boolean; hint?: string };
type NoteCheckResult = {
  title: string;
  summary: string;
  items: NoteCheckItem[];
  missing: string[];
};

function hasAny(text: string, keywords: string[]) {
  const t = (text ?? "").toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

function looksLikeHasNumber(text: string) {
  return /\d/.test(text ?? "");
}

function buildNoteCheck(tradeType: TradeType, entryPrice: number, stopLoss: number | "", note: string): NoteCheckResult {
  const t = (note ?? "").trim();
  const wordy = t.replace(/\s+/g, " ");
  const isTooShort = wordy.length < 80;
  const missing: string[] = [];
  const items: NoteCheckItem[] = [];

  items.push({
    label: "메모 길이(최소 2~3문장)",
    ok: !isTooShort,
    hint: isTooShort ? "지금은 너무 짧아. ‘근거/기준/조건’을 최소 2~3문장으로 늘려줘." : undefined,
  });

  items.push({
    label: "진입가 입력",
    ok: Number.isFinite(entryPrice) && entryPrice > 0,
    hint: "진입가는 필수야.",
  });

  items.push({
    label: "손절가 또는 손절 기준 언급(없으면 ‘없음’이라고라도)",
    ok: stopLoss !== "" || hasAny(t, ["손절", "컷", "stop", "sl", "이탈", "-%"]),
    hint: "손절가 입력이 없으면 메모에 ‘손절 기준(조건/레벨/%)’이라도 적어줘.",
  });

  const pushMap = (map: NoteCheckItem[]) => {
    items.push(...map);
    map.forEach((x) => {
      if (!x.ok) missing.push(x.label);
    });
  };

  if (tradeType === "long") {
    pushMap([
      { label: "기업/산업/해자(경쟁우위) 언급", ok: hasAny(t, ["산업", "해자", "경쟁", "moat", "점유율", "브랜드", "제품", "고객"]), hint: "왜 ‘이 회사’를 믿는지 한 줄이라도." },
      { label: "밸류 기준(숫자/지표) 언급", ok: hasAny(t, ["per", "pbr", "ps", "fcf", "밸류", "밸류에이션", "멀티플"]) && looksLikeHasNumber(t), hint: "PER/PBR/PS/FCF 중 1개 + 숫자 한 개라도." },
      { label: "재무/안정성 리스크 체크 언급", ok: hasAny(t, ["부채", "현금흐름", "이자보상", "리스크", "유동"]), hint: "부채/현금흐름/이자보상 등 리스크 하나만." },
      { label: "1~3년 시나리오/촉매 언급", ok: hasAny(t, ["시나리오", "촉매", "2년", "3년", "장기", "성장", "확장"]), hint: "2~3년 관점 ‘기대 시나리오’를 한 줄." },
      { label: "Thesis break(생각 바뀌는 조건) 언급", ok: hasAny(t, ["thesis", "브레이크", "생각", "틀렸", "조건", "전량", "정리"]), hint: "‘어떤 일이면 틀렸다고 인정?’ 조건 1개." },
      { label: "분할매수/추가매수 계획 언급", ok: hasAny(t, ["분할", "추가매수", "적립", "리밸", "비중", "계획"]), hint: "추가매수 조건(가격/상황) 한 줄." },
    ]);
  }

  if (tradeType === "swing") {
    pushMap([
      { label: "트리거(무엇 보고 들어갔는지) 언급", ok: hasAny(t, ["트리거", "돌파", "지지", "저항", "거래량", "수급", "패턴", "뉴스"]), hint: "지지/저항/거래량/뉴스 중 1개라도." },
      { label: "진입 기준(레벨/조건) 언급", ok: hasAny(t, ["진입", "확인", "레벨", "구간", "돌파", "이탈"]), hint: "예: ‘OO 돌파 확인 후’ 같은 한 줄." },
      { label: "손절 기준(숫자/레벨) 언급", ok: hasAny(t, ["손절", "컷", "이탈", "-%", "손실"]), hint: "가격/레벨/% 중 하나로 명확히." },
      { label: "익절/분할익절(목표가/구간) 언급", ok: hasAny(t, ["익절", "목표", "분할익절", "rr", "손익비", "+%"]), hint: "목표 구간 또는 RR 언급." },
      { label: "이벤트/기간 리스크 고려 언급", ok: hasAny(t, ["기간", "며칠", "주", "실적", "발표", "cpi", "fomc", "이벤트", "리스크"]), hint: "실적/발표/매크로 변수 1개라도." },
      { label: "대안(같은 자금이면?) 한 줄", ok: hasAny(t, ["대안", "다른", "더 좋은", "자리", "종목"]) || hasAny(t, ["없음"]), hint: "없으면 ‘없음’이라도 써도 됨." },
    ]);
  }

  if (tradeType === "day") {
    pushMap([
      { label: "진입 근거(한 문장 요약) 언급", ok: hasAny(t, ["체결", "체결강도", "거래량", "호가", "모멘텀", "돌파", "갭"]), hint: "체결/거래량/호가/모멘텀 중 1개." },
      { label: "손절 규칙(즉시 컷 조건) 언급", ok: hasAny(t, ["손절", "컷", "틱", "-%", "이탈", "최대손실"]), hint: "틱/퍼센트/레벨 + 최대손실 한도까지면 베스트." },
      { label: "익절 규칙(목표/분할/트레일) 언급", ok: hasAny(t, ["익절", "분할익절", "트레일", "목표", "+%"]), hint: "목표 구간 1개라도." },
      { label: "실행 점검(원칙 위반 여부) 언급", ok: hasAny(t, ["실행", "계획", "늦진입", "추격", "충동", "원칙", "위반"]), hint: "늦진입/추격/충동 여부 체크." },
      { label: "멘탈/과매매 신호 언급", ok: hasAny(t, ["멘탈", "감정", "조급", "복수", "과매매", "흥분", "공포"]), hint: "조급/복수매매/과매매 여부." },
      { label: "다음에 바꿀 1가지 언급", ok: hasAny(t, ["다음", "개선", "바꿀", "1개"]), hint: "‘다음엔 딱 이것만’ 한 줄." },
    ]);
  }

  if (tradeType === "etf") {
    pushMap([
      { label: "ETF 역할(코어/방어/성장/배당 등) 언급", ok: hasAny(t, ["역할", "코어", "방어", "성장", "배당", "섹터", "레버", "위성"]), hint: "이 ETF가 포트폴리오에서 뭘 담당하는지." },
      { label: "추종 지수/전략(무엇을 따라가나) 언급", ok: hasAny(t, ["지수", "추종", "s&p", "sp500", "나스닥", "nasdaq", "커버드콜", "모멘텀", "가치"]), hint: "예: S&P500 / 나스닥100 / 커버드콜 등." },
      { label: "비용/구조(TER/환헤지/분배금 등) 언급", ok: hasAny(t, ["총보수", "ter", "보수", "수수료", "추적오차", "환헤지", "헤지", "분배금", "배당"]), hint: "최소 1개라도 적기." },
      { label: "매수 기준(정기적립/조정시/룰) 언급", ok: hasAny(t, ["정기", "적립", "룰", "기준", "조정", "-%", "추가매수"]), hint: "‘언제/어떻게 살지’ 룰 한 줄." },
      { label: "리밸런싱 규칙(비중 흔들릴 때) 언급", ok: hasAny(t, ["리밸", "비중", "분기", "반기", "±", "%p"]), hint: "분기 1회 / ±5% 등 간단히." },
      { label: "정리 기준(언제 팔지) 언급", ok: hasAny(t, ["정리", "매도", "청산", "기간", "조건", "룰"]), hint: "기간/조건/룰 중 하나." },
    ]);
  }

  const okCount = items.filter((x) => x.ok).length;
  const total = items.length;
  const summary =
    missing.length === 0
      ? `완전 좋음. 이대로 AI 돌려도 낭비가 거의 없어. (${okCount}/${total})`
      : `빠진 게 있어. 체크 항목 보강하면 AI 결과가 확 좋아져. (${okCount}/${total})`;

  return {
    title: `${TAB_LABEL[tradeType]} 메모 점검`,
    summary,
    items,
    missing,
  };
}

/** =========================
 * ✅ C) 규칙 체크리스트 (UI)
 * ✅ C-2) 프리셋에 체크리스트까지 저장/불러오기
 * ========================= */
function rid() {
  // @ts-ignore
  return crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);
}

function defaultChecklistTexts(type: TradeType): string[] {
  if (type === "long") {
    return [
      "밸류 기준(지표+숫자) 1개 이상 적었다",
      "리스크(부채/현금흐름/실적) 1개 이상 체크했다",
      "Thesis break(틀리면 정리 조건) 1개 적었다",
      "추가매수/비중 조절 규칙을 적었다",
      "감정으로 계획 변경 안 했다",
    ];
  }
  if (type === "swing") {
    return [
      "진입 트리거(레벨/이벤트) 1문장으로 명확했다",
      "손절 기준을 숫자(가격/%/레벨)로 정했다",
      "익절/분할익절 구간을 정했다",
      "이벤트 캘린더(실적/발표) 확인했다",
      "추격/물타기/계획 변경 안 했다",
    ];
  }
  if (type === "day") {
    return [
      "손절 트리거를 즉시 실행했다(틱/%/레벨)",
      "1회 최대손실 한도를 지켰다",
      "재진입/복수매매 규칙을 지켰다",
      "추격 진입을 피했다(늦진입 금지)",
      "수수료/슬리피지 포함 손익을 확인했다",
    ];
  }
  // etf
  return [
    "이 ETF의 역할(코어/방어/배당)을 명확히 했다",
    "추종 지수/전략을 확인했다",
    "총보수(TER)/환헤지/분배금 구조를 확인했다",
    "매수 규칙(정기적립/조정시)을 지켰다",
    "리밸런싱/정리 규칙을 지켰다",
  ];
}

function makeChecklistFromTexts(texts: string[]): ChecklistItem[] {
  return texts.map((t) => ({ id: rid(), text: t, checked: false }));
}

function buildChecklistSummary(list: ChecklistItem[]) {
  if (!list?.length) return "";
  const lines = list.map((c) => `- ${c.checked ? "[x]" : "[ ]"} ${c.text}`);
  return ["", "[규칙 체크]", ...lines].join("\n");
}

export default function Page() {
  const [tradeType, setTradeType] = useState<TradeType>("long");

  const [ticker, setTicker] = useState("");
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [reasonNote, setReasonNote] = useState<string>("");

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ✅ 히스토리 state
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ✅ 오늘 사용량 표시용
  const [dailyCount, setDailyCount] = useState(0);

  // ✅ A) 메모 점검 결과
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkResult, setCheckResult] = useState<NoteCheckResult | null>(null);

  // ✅ C) 체크리스트 state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(makeChecklistFromTexts(defaultChecklistTexts("long")));

  // ✅ C-2) 프리셋 state
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);

  // ✅✅ NEW: 규칙 체크 접기/펼치기 + “탭별 1회 필수” 상태
  const [rulesOpen, setRulesOpen] = useState(true);
  const [rulesCheckedOnce, setRulesCheckedOnce] = useState<Record<TradeType, boolean>>({
    long: false,
    swing: false,
    day: false,
    etf: false,
  });

  // ✅ 최초 1회: localStorage 로드
  useEffect(() => {
    // history
    const list = safeJsonParse<HistoryItem[]>(
      typeof window !== "undefined" ? localStorage.getItem(HISTORY_KEY) : null,
      []
    );
    const normalized = [...list]
      .filter((x) => x && x.id && x.createdAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FREE_HISTORY_LIMIT);
    setHistory(normalized);
    if (typeof window !== "undefined") localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));

    // daily usage
    const usage = readDailyUsage();
    writeDailyUsage(usage);
    setDailyCount(usage.count);

    // presets
    const rawPresets = safeJsonParse<Preset[]>(
      typeof window !== "undefined" ? localStorage.getItem(PRESET_KEY) : null,
      []
    );
    const normPresets = [...rawPresets]
      .filter((p) => p && p.id && p.createdAt && p.name)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FREE_PRESET_LIMIT);
    setPresets(normPresets);
    if (typeof window !== "undefined") localStorage.setItem(PRESET_KEY, JSON.stringify(normPresets));
  }, []);

  function persistHistory(next: HistoryItem[]) {
    const trimmed = next.sort((a, b) => b.createdAt - a.createdAt).slice(0, FREE_HISTORY_LIMIT);
    setHistory(trimmed);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }

  function saveToHistory(payload: Omit<HistoryItem, "id" | "createdAt">) {
    const item: HistoryItem = { id: rid(), createdAt: Date.now(), ...payload };
    persistHistory([item, ...history]);
  }

  function removeHistory(id: string) {
    persistHistory(history.filter((h) => h.id !== id));
  }

  function clearHistoryAll() {
    persistHistory([]);
  }

  // ✅ presets
  function persistPresets(next: Preset[]) {
    const trimmed = next.sort((a, b) => b.createdAt - a.createdAt).slice(0, FREE_PRESET_LIMIT);
    setPresets(trimmed);
    localStorage.setItem(PRESET_KEY, JSON.stringify(trimmed));
  }

  function savePreset() {
    const name = prompt("프리셋 이름을 적어줘 (예: 내 단타 규칙, QQQ 코어 적립)");
    if (!name?.trim()) return;

    const item: Preset = {
      id: rid(),
      createdAt: Date.now(),
      name: name.trim().slice(0, 30),
      tradeType,
      ticker,
      entryPrice,
      stopLoss: stopLoss === "" ? null : stopLoss,
      reasonNote,
      checklistTexts: checklist.map((c) => c.text).slice(0, 12),
    };

    persistPresets([item, ...presets]);
    setPresetOpen(true);
  }

  function deletePreset(id: string) {
    persistPresets(presets.filter((p) => p.id !== id));
  }

  function applyPreset(p: Preset) {
    setTradeType(p.tradeType);
    setTicker(p.ticker ?? "");
    setEntryPrice(Number(p.entryPrice ?? 100));
    setStopLoss(p.stopLoss ?? "");
    setReasonNote(p.reasonNote ?? "");
    setChecklist(makeChecklistFromTexts(p.checklistTexts?.length ? p.checklistTexts : defaultChecklistTexts(p.tradeType)));

    setResult("");
    setCheckOpen(false);
    setCheckResult(null);

    // ✅ NEW: 프리셋 불러와도 “규칙 체크 1회 필수”는 다시 하게(초기화)
    setRulesCheckedOnce((prev) => ({ ...prev, [p.tradeType]: false }));
  }

  async function exportHistoryItem(h: HistoryItem) {
    gaEvent(GA_EVENT.EXPORT_HISTORY, { tradeType: h.tradeType, ticker: h.ticker });
    const text = buildExportText(h);

    try {
      await copyText(text);
      alert("복기 텍스트를 복사했어! (붙여넣기 하면 돼)");
    } catch {
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (w) {
        w.document.write(`<pre style="white-space:pre-wrap;font-family:system-ui;padding:16px">${escapeHtml(text)}</pre>`);
        w.document.close();
      } else {
        prompt("복사해서 사용해줘:", text);
      }
    }
  }

  function loadHistoryItem(h: HistoryItem) {
    gaEvent(GA_EVENT.LOAD_HISTORY, { tradeType: h.tradeType, ticker: h.ticker });

    setTradeType(h.tradeType);
    setTicker(h.ticker);
    setEntryPrice(h.entryPrice);
    setStopLoss(h.stopLoss ?? "");
    setReasonNote(h.reasonNote);
    setResult(h.result);

    // ✅ C: 기록에 체크리스트가 있으면 그대로 복원, 없으면 기본값
    const nextChecklist =
      h.checklist && h.checklist.length
        ? h.checklist.map((c) => ({ ...c, id: c.id || rid() }))
        : makeChecklistFromTexts(defaultChecklistTexts(h.tradeType));
    setChecklist(nextChecklist);

    cacheRef.current[h.tradeType] = {
      ticker: h.ticker,
      entryPrice: h.entryPrice,
      stopLoss: h.stopLoss ?? "",
      reasonNote: h.reasonNote,
      result: h.result,
      checklist: nextChecklist,
      rulesCheckedOnce: false,
      rulesOpen: false,
    };

    setCheckOpen(false);
    setCheckResult(null);

    // ✅ NEW: 불러오기 후에도 규칙 체크는 “그날 그때” 다시 하게 1회 필수로(초기화)
    setRulesCheckedOnce((prev) => ({ ...prev, [h.tradeType]: false }));
  }

  // ✅ 탭별 입력/결과/체크리스트 저장 (탭 이동해도 유지)
  const cacheRef = useRef<
    Record<
      TradeType,
      {
        ticker: string;
        entryPrice: number;
        stopLoss: number | "";
        reasonNote: string;
        result: string;
        checklist: ChecklistItem[];
        rulesCheckedOnce: boolean;
        rulesOpen: boolean;
      }
    >
  >({
    long: {
      ticker: "",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
      checklist: makeChecklistFromTexts(defaultChecklistTexts("long")),
      rulesCheckedOnce: false,
      rulesOpen: true,
    },
    swing: {
      ticker: "",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
      checklist: makeChecklistFromTexts(defaultChecklistTexts("swing")),
      rulesCheckedOnce: false,
      rulesOpen: true,
    },
    day: {
      ticker: "",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
      checklist: makeChecklistFromTexts(defaultChecklistTexts("day")),
      rulesCheckedOnce: false,
      rulesOpen: true,
    },
    etf: {
      ticker: "",
      entryPrice: 100,
      stopLoss: "",
      reasonNote: "",
      result: "",
      checklist: makeChecklistFromTexts(defaultChecklistTexts("etf")),
      rulesCheckedOnce: false,
      rulesOpen: true,
    },
  });

  const prevTradeType = useRef<TradeType>("long");
  useEffect(() => {
    const prev = prevTradeType.current;
    cacheRef.current[prev] = { ticker, entryPrice, stopLoss, reasonNote, result, checklist, rulesCheckedOnce: rulesCheckedOnce[prev], rulesOpen: rulesOpen };

    const next = cacheRef.current[tradeType];
    setTicker(next.ticker);
    setEntryPrice(next.entryPrice);
    setStopLoss(next.stopLoss);
    setReasonNote(next.reasonNote);
    setResult(next.result);

    setChecklist(next.checklist?.length ? next.checklist : makeChecklistFromTexts(defaultChecklistTexts(tradeType)));

    // ✅ NEW: 탭별 “규칙 체크 1회”/열림 상태 복원
    setRulesCheckedOnce((prevMap) => ({ ...prevMap, [tradeType]: next.rulesCheckedOnce }));
    setRulesOpen(next.rulesOpen);

    prevTradeType.current = tradeType;
    setCheckOpen(false);
    setCheckResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeType]);

  const title = useMemo(() => `AI 투자 복기 리포트 (MVP)`, []);

  // ✅ A) 메모 점검
  function onCheckNote() {
    const r = buildNoteCheck(tradeType, entryPrice, stopLoss, reasonNote);
    setCheckResult(r);
    setCheckOpen(true);
  }

  // ✅✅ NEW: 규칙 체크 “1회 완료” 처리(탭별)
  function markRulesCheckedOnce() {
    setRulesCheckedOnce((prev) => ({ ...prev, [tradeType]: true }));
  }

  // ✅ C: 체크리스트 조작 (조작하면 ‘1회’로 인정)
  function toggleChecklist(id: string) {
    markRulesCheckedOnce();
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));
  }
  function editChecklistText(id: string, text: string) {
    markRulesCheckedOnce();
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }
  function addChecklistItem() {
    markRulesCheckedOnce();
    setChecklist((prev) => [...prev, { id: rid(), text: "새 규칙", checked: false }]);
  }
  function removeChecklistItem(id: string) {
    markRulesCheckedOnce();
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  }
  function resetChecklistToDefault() {
    markRulesCheckedOnce();
    setChecklist(makeChecklistFromTexts(defaultChecklistTexts(tradeType)));
  }
  function clearChecklistChecks() {
    markRulesCheckedOnce();
    setChecklist((prev) => prev.map((c) => ({ ...c, checked: false })));
  }

  function buildReasonForAI() {
    const base = (reasonNote ?? "").trim();
    const ck = buildChecklistSummary(checklist);
    return (base ? base : "(메모 없음)") + ck;
  }

  async function onGenerate() {
    if (!ticker.trim()) {
      alert("종목/티커/코인명을 입력해줘!");
      return;
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      alert("진입가(필수)를 올바르게 입력해줘! (0보다 큰 숫자)");
      return;
    }

    // ✅✅✅ NEW: “규칙 체크 1회” 필수 게이트 (옵션 없음)
    if (!rulesCheckedOnce[tradeType]) {
      setRulesOpen(true);
      alert("AI 생성 전에 ‘규칙 체크(점검)’을 최소 1번은 해줘!");
      return;
    }

    const usage = readDailyUsage();
    if (usage.count >= DAILY_LIMIT) {
      alert("무료 버전은 하루에 2회까지만 AI 복기 리포트를 생성할 수 있어요 🙏");
      return;
    }

    gaEvent(GA_EVENT.GENERATE_REPORT, { tradeType, ticker });

    setLoading(true);
    setResult("AI가 리포트를 작성 중입니다...");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          entryPrice,
          stopLoss: stopLoss === "" ? null : stopLoss,
          reasonNote: buildReasonForAI(),
          tradeType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(`서버 에러 (${res.status}): ${data?.text ?? JSON.stringify(data)}`);
        return;
      }

      writeDailyUsage({ date: usage.date, count: usage.count + 1 });
      setDailyCount(usage.count + 1);

      const text = data?.text ?? "응답에 text가 없습니다.";
      setResult(text);

      saveToHistory({
        tradeType,
        ticker,
        entryPrice,
        stopLoss: stopLoss === "" ? null : stopLoss,
        reasonNote,
        result: text,
        checklist,
      });

      setCheckOpen(false);
    } catch (err: any) {
      setResult(`네트워크/실행 오류: ${String(err?.message ?? err)}`);
    } finally {
      setLoading(false);
    }
  }

  function onClearAll() {
    const base = {
      ticker: "",
      entryPrice: 100,
      stopLoss: "" as const,
      reasonNote: "",
      result: "",
    };

    setTicker(base.ticker);
    setEntryPrice(base.entryPrice);
    setStopLoss(base.stopLoss);
    setReasonNote(base.reasonNote);
    setResult(base.result);

    const nextChecklist = makeChecklistFromTexts(defaultChecklistTexts(tradeType));
    setChecklist(nextChecklist);

    cacheRef.current[tradeType] = {
      ...base,
      checklist: nextChecklist,
      rulesCheckedOnce: false,
      rulesOpen: true,
    };

    setRulesCheckedOnce((prev) => ({ ...prev, [tradeType]: false }));
    setRulesOpen(true);

    setCheckOpen(false);
    setCheckResult(null);
  }

  function onPrintPdfResultOnly() {
    if (!result) return;

    gaEvent(GA_EVENT.DOWNLOAD_PDF, { tradeType, ticker });

    const label = TAB_LABEL[tradeType];
    const docTitle = `AI 투자 복기 리포트 - ${label} - ${ticker}`;
    const stopLossText = stopLoss === "" ? "N/A" : String(stopLoss);

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 10px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
    pre { white-space: pre-wrap; line-height: 1.6; font-size: 13px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(docTitle)}</h1>
  <div class="meta">
    Type: ${escapeHtml(label)}
    / Query: ${escapeHtml(ticker)}
    / Entry: ${escapeHtml(String(entryPrice))}
    / StopLoss: ${escapeHtml(stopLossText)}
  </div>
  <pre>${escapeHtml(result)}</pre>
</body>
</html>
`.trim();

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }

  const tabBtn = (key: TradeType) => {
    const active = tradeType === key;
    return (
      <button
        key={key}
        onClick={() => setTradeType(key)}
        style={{
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: active ? "#2563eb" : "white",
          color: active ? "white" : "#111827",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {TAB_LABEL[key]}
      </button>
    );
  };

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "24px auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{title}</h1>

      <p style={{ color: "#6b7280", marginTop: 0 }}>
        장기/스윙/단타/ETF 탭으로 분리해서 기록합니다. (무료: 최근 {FREE_HISTORY_LIMIT}개 오프라인 저장)
      </p>

      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 10 }}>
        오늘 무료 사용: {dailyCount} / {DAILY_LIMIT} (남은 횟수: {Math.max(0, DAILY_LIMIT - dailyCount)})
      </div>

      <div style={{ display: "flex", gap: 10, margin: "14px 0 18px", flexWrap: "wrap" }}>
        {(["long", "swing", "day", "etf"] as TradeType[]).map(tabBtn)}
      </div>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          background: "white",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ fontWeight: 800 }}>
            종목/티커/코인명 (검색어)
            <input
              value={ticker}
              onChange={(e) => setTicker(clampTicker(e.target.value))}
              placeholder="예: 애플 / AAPL / 삼성전자 / 005930 / 비트코인 / BTC / VOO / QQQ"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            진입가 <span style={{ fontWeight: 700, color: "#ef4444" }}>(필수)</span>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              placeholder="예: 100.5"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            손절가 <span style={{ fontWeight: 600, color: "#6b7280" }}>(선택 · 필수 아님)</span>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="예: 92.5 (손절 기준이 없다면 비워두세요)"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            메모(왜 이 매매를 했는지 상세 기록) — {TAB_LABEL[tradeType]}
            <textarea
              value={reasonNote}
              placeholder={NOTE_TEMPLATES[tradeType]}
              onChange={(e) => setReasonNote(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                minHeight: 170,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
          </label>

          {/* ✅✅ NEW: 규칙 체크 “필수 배지/토글 바” (접어도 필수 느낌 유지) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, color: "#111827", fontSize: 13 }}>
              {rulesCheckedOnce[tradeType] ? "✅ 규칙 체크 완료(1회)" : "⚠️ 규칙 체크 필수(AI 생성 전 1회)"}
              <span style={{ fontWeight: 700, color: "#6b7280" }}> · {TAB_LABEL[tradeType]}</span>
            </div>

            <button
              onClick={() => setRulesOpen((v) => !v)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              {rulesOpen ? "규칙 접기" : "규칙 열기"}
            </button>
          </div>

          {/* ✅ C) 규칙 체크리스트 UI (접기/펼치기 적용) */}
          {rulesOpen && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>규칙 체크(점검)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={addChecklistItem}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #111827",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    + 규칙 추가
                  </button>
                  <button
                    onClick={clearChecklistChecks}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    체크 초기화
                  </button>
                  <button
                    onClick={resetChecklistToDefault}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                    title="탭 기본 규칙으로 되돌림"
                  >
                    기본 규칙
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {checklist.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fafafa",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                        <input type="checkbox" checked={c.checked} onChange={() => toggleChecklist(c.id)} />
                        <span style={{ fontWeight: 900, color: "#111827" }}>{c.checked ? "완료" : "미완료"}</span>
                      </label>

                      <button
                        onClick={() => removeChecklistItem(c.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                        title="삭제"
                      >
                        삭제
                      </button>
                    </div>

                    <input
                      value={c.text}
                      onChange={(e) => editChecklistText(c.id, e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        outline: "none",
                        background: "white",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
                * AI 생성 시 메모에 <b>[규칙 체크]</b> 섹션으로 자동 첨부돼요.
              </div>
            </div>
          )}

          {/* ✅ 프리셋(규칙 세트) UI */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 14,
              background: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, color: "#111827" }}>프리셋(규칙 세트)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={savePreset}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #111827",
                    background: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  title="현재 입력 + 체크리스트(텍스트)를 프리셋으로 저장"
                >
                  프리셋 저장
                </button>
                <button
                  onClick={() => setPresetOpen((v) => !v)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {presetOpen ? "프리셋 닫기" : "프리셋 보기"}
                </button>
              </div>
            </div>

            {presetOpen && (
              <div style={{ marginTop: 10 }}>
                {presets.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>아직 저장된 프리셋이 없어. “프리셋 저장”부터 해줘.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {presets.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 12,
                          background: "#fafafa",
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            [{TAB_LABEL[p.tradeType]}] {p.name}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => applyPreset(p)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #111827",
                                background: "white",
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                            >
                              불러오기
                            </button>
                            <button
                              onClick={() => deletePreset(p.id)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "white",
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        <div style={{ color: "#6b7280", fontSize: 12 }}>
                          {formatDateTime(p.createdAt)} · {p.ticker ? `Query: ${p.ticker}` : "Query 없음"}
                        </div>

                        <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                          규칙 {p.checklistTexts?.length ?? 0}개 · 메모 {short(p.reasonNote || "(없음)", 60)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
                  * 무료: 프리셋 최대 {FREE_PRESET_LIMIT}개까지 저장
                </div>
              </div>
            )}
          </div>

          {/* ✅ 가이드/예시 카드 */}
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 4,
              padding: 12,
              borderRadius: 12,
              border: "1px dashed #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, color: "#111827" }}>{TAB_LABEL[tradeType]} 작성 가이드 & 예시</div>

            <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>✅ 꼭 포함하면 좋은 항목</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{NOTE_TEMPLATES[tradeType]}</pre>
            </div>

            <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>📝 예시</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{EXAMPLE_NOTES[tradeType]}</pre>
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onGenerate}
              disabled={loading}
              style={{
                flex: 1,
                minWidth: 260,
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "작성 중..." : "AI 복기 리포트 생성"}
            </button>

            {/* ✅ A) 메모 점검 버튼 */}
            <button
              onClick={onCheckNote}
              disabled={!ticker.trim() && !reasonNote.trim()}
              title={!ticker.trim() && !reasonNote.trim() ? "종목/메모를 조금이라도 적어줘" : "AI 없이 메모 품질을 점검"}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "white",
                fontWeight: 900,
                cursor: !ticker.trim() && !reasonNote.trim() ? "not-allowed" : "pointer",
                opacity: !ticker.trim() && !reasonNote.trim() ? 0.5 : 1,
              }}
            >
              메모 점검(무료)
            </button>

            <button
              onClick={onPrintPdfResultOnly}
              disabled={!result}
              title={!result ? "먼저 결과를 생성하세요" : "결과만 PDF로 저장"}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "white",
                fontWeight: 900,
                cursor: !result ? "not-allowed" : "pointer",
                opacity: !result ? 0.5 : 1,
              }}
            >
              PDF로 저장(결과만)
            </button>

            <button
              onClick={onClearAll}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              결과/입력 리셋
            </button>
          </div>

          {/* ✅ A) 점검 결과 패널 */}
          {checkOpen && checkResult && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 12,
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>{checkResult.title}</div>
                <button
                  onClick={() => setCheckOpen(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  닫기
                </button>
              </div>

              <div style={{ marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.5 }}>{checkResult.summary}</div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {checkResult.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#111827" }}>
                      {it.ok ? "✅" : "⚠️"} {it.label}
                    </div>
                    {!it.ok && it.hint && (
                      <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{it.hint}</div>
                    )}
                  </div>
                ))}
              </div>

              {checkResult.missing.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 12,
                    padding: 10,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>지금 보강하면 좋은 것</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {checkResult.missing.slice(0, 8).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 결과 */}
      {result && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "white",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>결과</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: 10,
              lineHeight: 1.6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              color: "#111827",
            }}
          >
            {result}
          </pre>
        </section>
      )}

      {/* 최근 저장된 복기 */}
      <section
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>최근 저장된 복기 (최대 {FREE_HISTORY_LIMIT}개)</h2>

          <button
            onClick={clearHistoryAll}
            disabled={history.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: history.length === 0 ? "not-allowed" : "pointer",
              opacity: history.length === 0 ? 0.5 : 1,
            }}
            title={history.length === 0 ? "저장된 기록이 없습니다" : "전체 삭제"}
          >
            전체 삭제
          </button>
        </div>

        {history.length === 0 ? (
          <p style={{ color: "#6b7280", marginTop: 10 }}>아직 저장된 복기가 없습니다. 리포트를 생성하면 자동으로 저장돼요.</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, color: "#111827" }}>
                    [{TAB_LABEL[h.tradeType]}] {h.ticker} / Entry {h.entryPrice}
                    {h.stopLoss != null ? ` / SL ${h.stopLoss}` : " / SL N/A"}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => loadHistoryItem(h)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="불러오기"
                    >
                      불러오기
                    </button>

                    <button
                      onClick={() => exportHistoryItem(h)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="텍스트로 내보내기(복사)"
                    >
                      내보내기
                    </button>

                    <button
                      onClick={() => removeHistory(h.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div style={{ color: "#6b7280", fontSize: 12 }}>{formatDateTime(h.createdAt)}</div>

                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>메모 요약</div>
                  {short(h.reasonNote || "(메모 없음)", 120)}
                </div>

                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>결과 요약</div>
                  {short(h.result || "(결과 없음)", 140)}
                </div>

                {h.checklist?.length ? (
                  <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 900, marginBottom: 4 }}>규칙 체크</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {h.checklist.slice(0, 5).map((c) => (
                        <div key={c.id} style={{ color: "#6b7280" }}>
                          {c.checked ? "✅" : "⬜"} {c.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>
          * 무료 버전은 기기(브라우저) 내부 저장(localStorage)이라, 브라우저 데이터 삭제/기기 변경 시 기록이 사라질 수 있어요.
        </p>
      </section>
    </main>
  );
}
