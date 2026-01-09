// app/page.tsx

"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { gaEvent, GA_EVENT } from "@/lib/ga";
import {
  AssetType,
  TradeType,
  Preset,
  HistoryItem,
  ChecklistItem,
  ASSET_LABEL,
  TAB_LABEL,
  NOTE_TEMPLATES,
  EXAMPLE_NOTES,
  BOARDING_TITLE,
  BOARDING_BULLETS,
} from "./constants";

// =========================================================
// 🎨 UI 컴포넌트: 토스 심사 통과용 모달 (Alert & Prompt 대체)
// =========================================================

// 1. 단순 알림창 (AlertModal)
function AlertModal({
  isOpen,
  message,
  onClose,
}: {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", width: "100%", maxWidth: 320, borderRadius: 16,
          padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", textAlign: "center",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: "100%", padding: "12px", background: "#2563eb",
            color: "white", fontWeight: 700, borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// 2. 입력창 (InputModal) - 프리셋 저장용
function InputModal({
  isOpen,
  title,
  placeholder,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  placeholder: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState("");

  useEffect(() => {
    if (isOpen) setVal("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        style={{
          background: "white", width: "100%", maxWidth: 320, borderRadius: 16,
          padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12 }}>{title}</div>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", padding: "12px", borderRadius: 8, border: "1px solid #d1d5db",
            fontSize: 15, outline: "none", marginBottom: 20, background: "white", color: "black"
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px", background: "#f3f4f6", color: "#4b5563",
              fontWeight: 700, borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(val)}
            style={{
              flex: 1, padding: "12px", background: "#2563eb", color: "white",
              fontWeight: 700, borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer",
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// 🧠 비즈니스 로직 (Main Page)
// =========================================================

function getApiUrl(path: string) {
  const VERCEL_URL = "https://invest-review-mvp.vercel.app";
  const origin = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_API_ORIGIN ?? VERCEL_URL) : VERCEL_URL;
  const clean = origin.replace(/\/$/, "");
  return `${clean}${path}`;
}

function clampTicker(v: string) {
  return v.replace(/[^\p{L}\p{N}\s.\-_]/gu, "").trim().slice(0, 40);
}

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const HISTORY_KEY = "invest_review_history_v2";
const FREE_HISTORY_LIMIT = 10;
const PRESET_KEY = "invest_rule_presets_v1";
const FREE_PRESET_LIMIT = 8;

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0"); const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function short(s: string, n = 80) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function buildExportText(h: HistoryItem) {
  const label = TAB_LABEL[h.tradeType];
  const created = formatDateTime(h.createdAt);
  const sl = h.stopLoss == null ? "N/A" : String(h.stopLoss);
  const checklistBlock = h.checklist && h.checklist.length
      ? ["", `【규칙 체크】`, ...h.checklist.map((c) => `- ${c.checked ? "[x]" : "[ ]"} ${c.text}`)].join("\n") : "";

  return [
    `AI 투자 복기 리포트`, `- 날짜: ${created}`, `- 타입: ${label}`, `- 종목(검색어): ${h.ticker}`,
    `- 진입가: ${h.entryPrice}`, `- 손절가: ${sl}`, ``, `【메모】`,
    h.reasonNote?.trim() ? h.reasonNote.trim() : "(없음)", checklistBlock, ``, `【AI 결과】`,
    h.result?.trim() ? h.result.trim() : "(없음)",
  ].filter(Boolean).join("\n");
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement("textarea"); ta.value = text;
  ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.top = "0";
  document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
}

const DAILY_LIMIT = 3;
const DAILY_LIMIT_KEY = "daily_ai_limit_v1";
type DailyUsage = { date: string; count: number };

function todayKeyLocal() {
  const d = new Date();
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
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
  } catch { return { date: today, count: 0 }; }
}

function writeDailyUsage(next: DailyUsage) {
  localStorage.setItem(DAILY_LIMIT_KEY, JSON.stringify(next));
}

type NoteCheckItem = { label: string; ok: boolean; hint?: string };
type NoteCheckResult = { title: string; summary: string; items: NoteCheckItem[]; missing: string[]; };

function hasAny(text: string, keywords: string[]) {
  const t = (text ?? "").toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

function looksLikeHasNumber(text: string) { return /\d/.test(text ?? ""); }

function buildNoteCheck(tradeType: TradeType, entryPrice: number, stopLoss: number | "", note: string): NoteCheckResult {
  const t = (note ?? "").trim();
  const wordy = t.replace(/\s+/g, " ");
  const isTooShort = wordy.length < 80;
  const missing: string[] = [];
  const items: NoteCheckItem[] = [];

  items.push({ label: "메모 길이(최소 2~3문장)", ok: !isTooShort, hint: isTooShort ? "지금은 너무 짧습니다." : undefined });
  items.push({ label: "진입가 입력", ok: Number.isFinite(entryPrice) && entryPrice > 0, hint: "진입가는 필수입니다." });
  items.push({ label: "손절가 또는 손절 기준 언급", ok: stopLoss !== "" || hasAny(t, ["손절", "컷", "stop", "sl", "이탈", "-%"]), hint: "손절가나 기준을 적어주세요." });

  const pushMap = (map: NoteCheckItem[]) => { items.push(...map); map.forEach((x) => { if (!x.ok) missing.push(x.label); }); };

  if (tradeType === "long") {
    pushMap([
      { label: "기업/산업/해자", ok: hasAny(t, ["산업", "해자", "경쟁", "moat", "점유율", "브랜드", "제품"]), hint: "경쟁우위 언급 필요" },
      { label: "밸류 기준", ok: hasAny(t, ["per", "pbr", "ps", "fcf", "밸류", "밸류에이션"]) && looksLikeHasNumber(t), hint: "PER/PBR 등 숫자 언급 필요" },
      { label: "재무 리스크", ok: hasAny(t, ["부채", "현금흐름", "이자보상", "리스크"]), hint: "재무 리스크 체크" },
      { label: "시나리오", ok: hasAny(t, ["시나리오", "촉매", "2년", "3년", "장기"]), hint: "장기 시나리오" },
      { label: "Thesis break", ok: hasAny(t, ["thesis", "브레이크", "생각", "틀렸", "조건", "전량", "정리"]), hint: "생각이 틀리는 조건" },
      { label: "추가매수 계획", ok: hasAny(t, ["분할", "추가매수", "적립", "리밸", "비중"]), hint: "추매 계획" },
    ]);
  } else if (tradeType === "swing") {
    pushMap([
      { label: "진입 트리거", ok: hasAny(t, ["트리거", "돌파", "지지", "저항", "거래량", "수급", "패턴"]), hint: "진입 이유" },
      { label: "진입 기준", ok: hasAny(t, ["진입", "확인", "레벨", "구간", "돌파"]), hint: "확인 후 진입" },
      { label: "손절 기준", ok: hasAny(t, ["손절", "컷", "이탈", "-%", "손실"]), hint: "손절 가격/조건" },
      { label: "익절 목표", ok: hasAny(t, ["익절", "목표", "분할익절", "rr", "손익비"]), hint: "목표가/손익비" },
      { label: "이벤트 리스크", ok: hasAny(t, ["기간", "며칠", "주", "실적", "발표", "cpi", "이벤트"]), hint: "일정 체크" },
      { label: "대안 고려", ok: hasAny(t, ["대안", "다른", "더 좋은", "자리"]) || hasAny(t, ["없음"]), hint: "대안 확인" },
    ]);
  } else if (tradeType === "day") {
    pushMap([
      { label: "진입 근거", ok: hasAny(t, ["체결", "체결강도", "거래량", "호가", "모멘텀", "돌파"]), hint: "수급/호가/차트" },
      { label: "칼손절 규칙", ok: hasAny(t, ["손절", "컷", "틱", "-%", "이탈", "최대손실"]), hint: "즉시 손절 조건" },
      { label: "익절 규칙", ok: hasAny(t, ["익절", "분할익절", "트레일", "목표", "+%"]), hint: "목표/트레일링" },
      { label: "실행 점검", ok: hasAny(t, ["실행", "계획", "늦진입", "추격", "충동", "원칙"]), hint: "뇌동매매 여부" },
      { label: "멘탈 관리", ok: hasAny(t, ["멘탈", "감정", "조급", "복수", "과매매"]), hint: "심리 상태" },
      { label: "개선점 1가지", ok: hasAny(t, ["다음", "개선", "바꿀", "1개"]), hint: "다음 매매 개선점" },
    ]);
  } else if (tradeType === "etf") {
    pushMap([
      { label: "ETF 역할", ok: hasAny(t, ["역할", "코어", "방어", "성장", "배당", "섹터"]), hint: "포트폴리오 내 역할" },
      { label: "추종 전략", ok: hasAny(t, ["지수", "추종", "s&p", "sp500", "나스닥", "커버드콜"]), hint: "기초자산/전략" },
      { label: "비용/구조", ok: hasAny(t, ["총보수", "ter", "보수", "수수료", "환헤지", "분배금"]), hint: "수수료/환헤지" },
      { label: "매수 룰", ok: hasAny(t, ["정기", "적립", "룰", "기준", "조정", "-%"]), hint: "적립/추매 룰" },
      { label: "리밸런싱", ok: hasAny(t, ["리밸", "비중", "분기", "반기", "±"]), hint: "비중 조절" },
      { label: "정리 기준", ok: hasAny(t, ["정리", "매도", "청산", "기간", "조건"]), hint: "매도 조건" },
    ]);
  }

  const okCount = items.filter((x) => x.ok).length;
  const total = items.length;
  const summary = missing.length === 0 ? `완벽합니다! (${okCount}/${total})` : `보완이 필요합니다. (${okCount}/${total})`;
  return { title: `${TAB_LABEL[tradeType]} 메모 점검`, summary, items, missing };
}

function rid() {
  // @ts-ignore
  return crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);
}

function defaultChecklistTexts(type: TradeType): string[] {
  if (type === "long") return ["밸류 기준(지표+숫자) 1개 이상 적었습니다", "리스크(부채/현금흐름/실적) 1개 이상 체크했습니다", "Thesis break(틀리면 정리 조건) 1개 적었습니다", "추가매수/비중 조절 규칙을 적었습니다", "감정으로 계획 변경을 하지 않았습니다"];
  if (type === "swing") return ["진입 트리거(레벨/이벤트)를 1문장으로 명확히 했습니다", "손절 기준을 숫자(가격/%/레벨)로 정했습니다", "익절/분할익절 구간을 정했습니다", "이벤트 캘린더(실적/발표)를 확인했습니다", "추격/물타기/계획 변경을 하지 않았습니다"];
  if (type === "day") return ["손절 트리거를 즉시 실행했습니다(틱/%/레벨)", "1회 최대손실 한도를 지켰습니다", "재진입/복수매매 규칙을 지켰습니다", "추격 진입을 피했습니다(늦진입 금지)", "수수료/슬리피지 포함 손익을 확인했습니다"];
  return ["이 ETF의 역할(코어/방어/배당)을 명확히 했습니다", "추종 지수/전략을 확인했습니다", "총보수(TER)/환헤지/분배금 구조를 확인했습니다", "매수 규칙(정기적립/조정시)을 지켰습니다", "리밸런싱/정리 규칙을 지켰습니다"];
}

function makeChecklistFromTexts(texts: string[]): ChecklistItem[] {
  return texts.map((t) => ({ id: rid(), text: t, checked: false }));
}

function buildChecklistSummary(list: ChecklistItem[]) {
  if (!list?.length) return "";
  const lines = list.map((c) => `- ${c.checked ? "[x]" : "[ ]"} ${c.text}`);
  return ["", "[규칙 체크]", ...lines].join("\n");
}

async function safeReadResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!raw || !raw.trim()) return { raw: "", data: null as any };
  if (contentType.includes("application/json")) {
    try { return { raw, data: JSON.parse(raw) as any }; } catch { return { raw, data: null as any }; }
  }
  return { raw, data: null as any };
}

export default function Page() {
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [tradeType, setTradeType] = useState<TradeType>("long");

  const [ticker, setTicker] = useState("");
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [reasonNote, setReasonNote] = useState<string>("");

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dailyCount, setDailyCount] = useState(0);

  const [checkOpen, setCheckOpen] = useState(false);
  const [checkResult, setCheckResult] = useState<NoteCheckResult | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(makeChecklistFromTexts(defaultChecklistTexts("long")));

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);

  const [rulesOpen, setRulesOpen] = useState(true);
  const [rulesCheckedOnce, setRulesCheckedOnce] = useState<Record<TradeType, boolean>>({
    long: false, swing: false, day: false, etf: false,
  });

  const [alertMsg, setAlertMsg] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);

  function showAlert(msg: string) {
    setAlertMsg(msg);
    setIsAlertOpen(true);
  }

  useEffect(() => {
    const list = safeJsonParse<HistoryItem[]>(typeof window !== "undefined" ? localStorage.getItem(HISTORY_KEY) : null, []);
    const normalized = [...list].filter((x) => x && x.id && x.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, FREE_HISTORY_LIMIT);
    setHistory(normalized);
    if (typeof window !== "undefined") localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));

    const usage = readDailyUsage();
    writeDailyUsage(usage);
    setDailyCount(usage.count);

    const rawPresets = safeJsonParse<Preset[]>(typeof window !== "undefined" ? localStorage.getItem(PRESET_KEY) : null, []);
    const normPresets = [...rawPresets].filter((p) => p && p.id && p.createdAt && p.name).sort((a, b) => b.createdAt - a.createdAt).slice(0, FREE_PRESET_LIMIT);
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

  function removeHistory(id: string) { persistHistory(history.filter((h) => h.id !== id)); }
  function clearHistoryAll() { persistHistory([]); }

  function persistPresets(next: Preset[]) {
    const trimmed = next.sort((a, b) => b.createdAt - a.createdAt).slice(0, FREE_PRESET_LIMIT);
    setPresets(trimmed);
    localStorage.setItem(PRESET_KEY, JSON.stringify(trimmed));
  }

  function handlePresetSaveClick() { setIsInputOpen(true); }

  function handlePresetSaveConfirm(name: string) {
    setIsInputOpen(false);
    if (!name?.trim()) return;
    const item: Preset = {
      id: rid(), createdAt: Date.now(), name: name.trim().slice(0, 30),
      tradeType, ticker, entryPrice, stopLoss: stopLoss === "" ? null : stopLoss,
      reasonNote, checklistTexts: checklist.map((c) => c.text).slice(0, 12),
    };
    persistPresets([item, ...presets]);
    setPresetOpen(true);
    showAlert("프리셋이 저장되었습니다.");
  }

  function deletePreset(id: string) { persistPresets(presets.filter((p) => p.id !== id)); }

  function applyPreset(p: Preset) {
    setTradeType(p.tradeType); setTicker(p.ticker ?? ""); setEntryPrice(Number(p.entryPrice ?? 100));
    setStopLoss(p.stopLoss ?? ""); setReasonNote(p.reasonNote ?? "");
    setChecklist(makeChecklistFromTexts(p.checklistTexts?.length ? p.checklistTexts : defaultChecklistTexts(p.tradeType)));
    setResult(""); setCheckOpen(false); setCheckResult(null);
    setRulesCheckedOnce((prev) => ({ ...prev, [p.tradeType]: false }));
  }

  async function exportHistoryItem(h: HistoryItem) {
    gaEvent(GA_EVENT.EXPORT_HISTORY, { tradeType: h.tradeType, ticker: h.ticker });
    const text = buildExportText(h);
    try {
      await copyText(text);
      showAlert("복기 텍스트를 복사했습니다. (붙여넣기 하시면 됩니다)");
    } catch {
      showAlert("복사에 실패했습니다. 텍스트를 직접 복사해주세요.");
    }
  }

  function loadHistoryItem(h: HistoryItem) {
    gaEvent(GA_EVENT.LOAD_HISTORY, { tradeType: h.tradeType, ticker: h.ticker });
    setTradeType(h.tradeType); setTicker(h.ticker); setEntryPrice(h.entryPrice);
    setStopLoss(h.stopLoss ?? ""); setReasonNote(h.reasonNote); setResult(h.result);
    const nextChecklist = h.checklist && h.checklist.length
        ? h.checklist.map((c) => ({ ...c, id: c.id || rid() }))
        : makeChecklistFromTexts(defaultChecklistTexts(h.tradeType));
    setChecklist(nextChecklist);
    cacheRef.current[h.tradeType] = { ticker: h.ticker, entryPrice: h.entryPrice, stopLoss: h.stopLoss ?? "", reasonNote: h.reasonNote, result: h.result, checklist: nextChecklist, rulesCheckedOnce: false, rulesOpen: false };
    setCheckOpen(false); setCheckResult(null);
    setRulesCheckedOnce((prev) => ({ ...prev, [h.tradeType]: false }));
  }

  const cacheRef = useRef<Record<TradeType, { ticker: string; entryPrice: number; stopLoss: number | ""; reasonNote: string; result: string; checklist: ChecklistItem[]; rulesCheckedOnce: boolean; rulesOpen: boolean; }>>({
    long: { ticker: "", entryPrice: 100, stopLoss: "", reasonNote: "", result: "", checklist: makeChecklistFromTexts(defaultChecklistTexts("long")), rulesCheckedOnce: false, rulesOpen: true },
    swing: { ticker: "", entryPrice: 100, stopLoss: "", reasonNote: "", result: "", checklist: makeChecklistFromTexts(defaultChecklistTexts("swing")), rulesCheckedOnce: false, rulesOpen: true },
    day: { ticker: "", entryPrice: 100, stopLoss: "", reasonNote: "", result: "", checklist: makeChecklistFromTexts(defaultChecklistTexts("day")), rulesCheckedOnce: false, rulesOpen: true },
    etf: { ticker: "", entryPrice: 100, stopLoss: "", reasonNote: "", result: "", checklist: makeChecklistFromTexts(defaultChecklistTexts("etf")), rulesCheckedOnce: false, rulesOpen: true },
  });

  const prevTradeType = useRef<TradeType>("long");
  useEffect(() => {
    if (assetType !== "stock") return;
    const prev = prevTradeType.current;
    cacheRef.current[prev] = { ticker, entryPrice, stopLoss, reasonNote, result, checklist, rulesCheckedOnce: rulesCheckedOnce[prev], rulesOpen: rulesOpen };
    const next = cacheRef.current[tradeType];
    setTicker(next.ticker); setEntryPrice(next.entryPrice); setStopLoss(next.stopLoss); setReasonNote(next.reasonNote); setResult(next.result);
    setChecklist(next.checklist?.length ? next.checklist : makeChecklistFromTexts(defaultChecklistTexts(tradeType)));
    setRulesCheckedOnce((prevMap) => ({ ...prevMap, [tradeType]: next.rulesCheckedOnce }));
    setRulesOpen(next.rulesOpen);
    prevTradeType.current = tradeType;
    setCheckOpen(false); setCheckResult(null);
  }, [tradeType, assetType]);

  const prevAssetType = useRef<AssetType>("stock");
  useEffect(() => {
    const prev = prevAssetType.current;
    if (prev === assetType) return;
    if (assetType === "coin") { setCheckOpen(false); setCheckResult(null); setLoading(false); }
    prevAssetType.current = assetType;
  }, [assetType]);

  const title = useMemo(() => ` AI 투자 복기 & 매매 규칙 체크 `, []);

  function onCheckNote() {
    const r = buildNoteCheck(tradeType, entryPrice, stopLoss, reasonNote);
    setCheckResult(r); setCheckOpen(true);
  }

  function markRulesCheckedOnce() { setRulesCheckedOnce((prev) => ({ ...prev, [tradeType]: true })); }
  function toggleChecklist(id: string) { markRulesCheckedOnce(); setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))); }
  function editChecklistText(id: string, text: string) { markRulesCheckedOnce(); setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c))); }
  function addChecklistItem() { markRulesCheckedOnce(); setChecklist((prev) => [...prev, { id: rid(), text: "새 규칙", checked: false }]); }
  function removeChecklistItem(id: string) { markRulesCheckedOnce(); setChecklist((prev) => prev.filter((c) => c.id !== id)); }
  function resetChecklistToDefault() { markRulesCheckedOnce(); setChecklist(makeChecklistFromTexts(defaultChecklistTexts(tradeType))); }
  function clearChecklistChecks() { markRulesCheckedOnce(); setChecklist((prev) => prev.map((c) => ({ ...c, checked: false }))); }
  function buildReasonForAI() { const base = (reasonNote ?? "").trim(); const ck = buildChecklistSummary(checklist); return (base ? base : "(메모 없음)") + ck; }

  async function onGenerate() {
    if (assetType !== "stock") { showAlert("현재는 주식 탭만 지원합니다."); return; }
    if (!ticker.trim()) { showAlert("종목/티커를 입력해 주세요."); return; }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) { showAlert("진입가(필수)를 올바르게 입력해 주세요."); return; }
    if (!rulesCheckedOnce[tradeType]) { setRulesOpen(true); showAlert("AI 생성 전에 ‘규칙 체크(점검)’을 최소 1회 진행해 주세요."); return; }
    const usage = readDailyUsage();
    if (usage.count >= DAILY_LIMIT) { showAlert("무료 버전은 하루에 3회까지만 AI 복기 리포트를 생성할 수 있습니다."); return; }

    gaEvent(GA_EVENT.GENERATE_REPORT, { tradeType, ticker });
    setLoading(true);
    setResult("AI가 리포트를 작성 중입니다...");

    try {
      const API_URL = getApiUrl("/api/ai");
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, entryPrice, stopLoss: stopLoss === "" ? null : stopLoss, reasonNote: buildReasonForAI(), tradeType }),
      });
      const { raw, data } = await safeReadResponse(res);
      if (!res.ok) {
        const msg = (data && data.text) ? data.text : (raw ? raw.slice(0, 400) : "서버 응답이 비어 있습니다.");
        setResult(`서버 에러 (${res.status}): ${msg}`);
        return;
      }
      writeDailyUsage({ date: usage.date, count: usage.count + 1 });
      setDailyCount(usage.count + 1);
      const text = data?.text ?? "응답에 text가 없습니다.";
      setResult(text);
      saveToHistory({ tradeType, ticker, entryPrice, stopLoss: stopLoss === "" ? null : stopLoss, reasonNote, result: text, checklist });
      setCheckOpen(false);
    } catch (err: any) { setResult(`네트워크/실행 오류: ${String(err?.message ?? err)}`); }
    finally { setLoading(false); }
  }

  function onClearAll() {
    const base = { ticker: "", entryPrice: 100, stopLoss: "" as const, reasonNote: "", result: "" };
    setTicker(base.ticker); setEntryPrice(base.entryPrice); setStopLoss(base.stopLoss); setReasonNote(base.reasonNote); setResult(base.result);
    const nextChecklist = makeChecklistFromTexts(defaultChecklistTexts(tradeType));
    setChecklist(nextChecklist);
    cacheRef.current[tradeType] = { ...base, checklist: nextChecklist, rulesCheckedOnce: false, rulesOpen: true };
    setRulesCheckedOnce((prev) => ({ ...prev, [tradeType]: false }));
    setRulesOpen(true); setCheckOpen(false); setCheckResult(null);
  }

  // ✅ [수정됨] PDF 인쇄 대신 -> '공유하기/복사하기' 기능으로 변경 (모바일 호환성 100%)
  async function onShareOrCopy() {
    if (!result) return;
    gaEvent(GA_EVENT.DOWNLOAD_PDF, { tradeType, ticker });

    const shareTitle = `AI 투자 복기 - ${ticker}`;
    const shareText = `[AI 투자 복기 리포트]\n\n종목: ${ticker}\n진입가: ${entryPrice}\n손절가: ${stopLoss || "없음"}\n\n${result}`;

    // 1. 모바일 앱(토스 등)에서는 '네이티브 공유' 창을 띄웁니다.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
        });
        return; // 공유 창이 뜨면 여기서 끝
      } catch (err) {
        // 사용자가 취소했거나 에러 나면 아래 복사 로직으로 넘어감
        console.log("공유 취소됨");
      }
    }

    // 2. 공유 기능이 없거나(PC), 실패하면 -> '클립보드 복사'로 대체
    try {
      await copyText(shareText);
      showAlert("결과 내용이 복사되었습니다.\n메모장이나 카톡에 붙여넣기 해주세요!");
    } catch {
      showAlert("복사에 실패했습니다. 텍스트를 직접 드래그해서 복사해주세요.");
    }
  }

  const assetBtn = (key: AssetType) => {
    const active = assetType === key;
    return (
      <button key={key} onClick={() => setAssetType(key)} style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid #e5e7eb", background: active ? "#111827" : "white", color: active ? "white" : "#111827", fontWeight: 900, cursor: "pointer" }}>{ASSET_LABEL[key]}</button>
    );
  };

  const tabBtn = (key: TradeType) => {
    const active = tradeType === key;
    return (
      <button key={key} onClick={() => setTradeType(key)} style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid #e5e7eb", background: active ? "#2563eb" : "white", color: active ? "white" : "#111827", fontWeight: 800, cursor: "pointer" }}>{TAB_LABEL[key]}</button>
    );
  };

  return (
    <main style={{ maxWidth: 920, margin: "24px auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <AlertModal isOpen={isAlertOpen} message={alertMsg} onClose={() => setIsAlertOpen(false)} />
      <InputModal isOpen={isInputOpen} title="프리셋 이름 저장" placeholder="예: 내 단타 규칙" onConfirm={handlePresetSaveConfirm} onCancel={() => setIsInputOpen(false)} />

      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{title}</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>주식/코인 탭으로 분리해 기록합니다. (무료: 최근 {FREE_HISTORY_LIMIT}개 오프라인 저장)</p>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 10 }}>오늘 무료 사용: {dailyCount} / {DAILY_LIMIT} (남은 횟수: {Math.max(0, DAILY_LIMIT - dailyCount)})</div>

      <div style={{ display: "flex", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>{(["stock", "coin"] as AssetType[]).map(assetBtn)}</div>

      <section style={{ marginTop: 6, border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#ffffff" }}>
        <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>{BOARDING_TITLE}</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#374151", fontSize: 13, lineHeight: 1.6 }}>{BOARDING_BULLETS.map((t, i) => (<li key={i}>{t}</li>))}</ul>
      </section>

      {assetType === "coin" ? (
        <section style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, background: "white" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>코인 기능은 준비 중입니다.</div>
          <div style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.6 }}>현물/선물 등 코인 전용 탭과 템플릿을 분리해 추가할 예정입니다.<br />현재는 주식 탭에서 장기/스윙/단타/ETF 기록을 사용할 수 있습니다.</div>
          <div style={{ marginTop: 14, borderRadius: 14, padding: 12, background: "#fafafa", border: "1px dashed #e5e7eb", color: "#374151", lineHeight: 1.6, fontSize: 13 }}>- 계획: 코인 탭 → “현물 / 선물” 2차 탭<br />- 코인 탭에서는 종목 예시(예: 비트코인 / BTC)를 별도로 제공할 예정입니다.</div>
        </section>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, margin: "14px 0 18px", flexWrap: "wrap" }}>{(["long", "swing", "day", "etf"] as TradeType[]).map(tabBtn)}</div>
          <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, background: "white" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontWeight: 800 }}>종목/티커 (검색어)<input value={ticker} onChange={(e) => setTicker(clampTicker(e.target.value))} placeholder="예: 애플 / AAPL / 삼성전자 / 005930 / VOO / QQQ" style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }} /></label>
              <label style={{ fontWeight: 800 }}>진입가 <span style={{ fontWeight: 700, color: "#ef4444" }}>(필수)</span><input type="number" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} placeholder="예: 100.5" style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }} /></label>
              <label style={{ fontWeight: 800 }}>손절가 <span style={{ fontWeight: 600, color: "#6b7280" }}>(선택 · 필수 아님)</span><input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value === "" ? "" : Number(e.target.value))} placeholder="예: 92.5 (손절 기준이 없다면 비워두세요)" style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }} /></label>
              <label style={{ fontWeight: 800 }}>메모(왜 이 매매를 했는지 상세 기록) — {TAB_LABEL[tradeType]}<textarea value={reasonNote} placeholder={NOTE_TEMPLATES[tradeType]} onChange={(e) => setReasonNote(e.target.value)} style={{ width: "100%", padding: 12, minHeight: 170, marginTop: 6, borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", lineHeight: 1.5 }} /></label>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" }}>
                <div style={{ fontWeight: 900, color: "#111827", fontSize: 13 }}>{rulesCheckedOnce[tradeType] ? "✅ 규칙 체크 완료(1회)" : "⚠️ 규칙 체크 필수(AI 생성 전 1회)"}<span style={{ fontWeight: 700, color: "#6b7280" }}> · {TAB_LABEL[tradeType]}</span></div>
                <button onClick={() => setRulesOpen((v) => !v)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>{rulesOpen ? "규칙 접기" : "규칙 열기"}</button>
              </div>

              {rulesOpen && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>규칙 체크(점검)</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={addChecklistItem} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer" }}>+ 규칙 추가</button>
                      <button onClick={clearChecklistChecks} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>체크 초기화</button>
                      <button onClick={resetChecklistToDefault} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }} title="탭 기본 규칙으로 되돌림">기본 규칙</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {checklist.map((c) => (
                      <div key={c.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fafafa", display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={c.checked} onChange={() => toggleChecklist(c.id)} /><span style={{ fontWeight: 900, color: "#111827" }}>{c.checked ? "완료" : "미완료"}</span></label>
                          <button onClick={() => removeChecklistItem(c.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }} title="삭제">삭제</button>
                        </div>
                        <input value={c.text} onChange={(e) => editChecklistText(c.id, e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", outline: "none", background: "white", fontWeight: 700 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>* AI 생성 시 메모에 <b>[규칙 체크]</b> 섹션으로 자동 첨부됩니다.</div>
                </div>
              )}

              <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900, color: "#111827" }}>프리셋(규칙 세트)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={handlePresetSaveClick} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer" }} title="현재 입력 + 체크리스트(텍스트)를 프리셋으로 저장">프리셋 저장</button>
                    <button onClick={() => setPresetOpen((v) => !v)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>{presetOpen ? "프리셋 닫기" : "프리셋 보기"}</button>
                  </div>
                </div>
                {presetOpen && (
                  <div style={{ marginTop: 10 }}>
                    {presets.length === 0 ? (<div style={{ color: "#6b7280", fontSize: 13 }}>아직 저장된 프리셋이 없습니다. “프리셋 저장”부터 진행해 주세요.</div>) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {presets.map((p) => (
                          <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa", display: "grid", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <div style={{ fontWeight: 900, color: "#111827" }}>[{TAB_LABEL[p.tradeType]}] {p.name}</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button onClick={() => applyPreset(p)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer" }}>불러오기</button>
                                <button onClick={() => deletePreset(p.id)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>삭제</button>
                              </div>
                            </div>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>{formatDateTime(p.createdAt)} · {p.ticker ? `Query: ${p.ticker}` : "Query 없음"}</div>
                            <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}>규칙 {p.checklistTexts?.length ?? 0}개 · 메모 {short(p.reasonNote || "(없음)", 60)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>* 무료: 프리셋 최대 {FREE_PRESET_LIMIT}개까지 저장됩니다.</div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 4, padding: 12, borderRadius: 12, border: "1px dashed #e5e7eb", background: "#fafafa" }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>{TAB_LABEL[tradeType]} 작성 가이드 & 예시</div>
                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}><div style={{ fontWeight: 900, marginBottom: 6 }}>✅ 꼭 포함하면 좋은 항목</div><pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{NOTE_TEMPLATES[tradeType]}</pre></div>
                <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}><div style={{ fontWeight: 900, marginBottom: 6 }}>📝 예시</div><pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{EXAMPLE_NOTES[tradeType]}</pre></div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={onGenerate} disabled={loading} style={{ flex: 1, minWidth: 260, padding: "14px 16px", borderRadius: 12, border: "none", background: loading ? "#93c5fd" : "#2563eb", color: "white", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "작성 중..." : "AI 복기 리포트 생성"}</button>
                <button onClick={onCheckNote} disabled={!ticker.trim() && !reasonNote.trim()} title={!ticker.trim() && !reasonNote.trim() ? "종목/메모를 조금이라도 작성해 주세요." : "AI 없이 메모 품질을 점검합니다."} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: !ticker.trim() && !reasonNote.trim() ? "not-allowed" : "pointer", opacity: !ticker.trim() && !reasonNote.trim() ? 0.5 : 1 }}>메모 점검(무료)</button>
                <button onClick={onShareOrCopy} disabled={!result} title={!result ? "먼저 결과를 생성해 주세요." : "결과를 공유하거나 복사합니다."} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: !result ? "not-allowed" : "pointer", opacity: !result ? 0.5 : 1 }}>결과 공유/저장 📤</button>
                <button onClick={onClearAll} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>결과/입력 리셋</button>
              </div>

              {checkOpen && checkResult && (
                <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>{checkResult.title}</div>
                    <button onClick={() => setCheckOpen(false)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }}>닫기</button>
                  </div>
                  <div style={{ marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.5 }}>{checkResult.summary}</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {checkResult.items.map((it, idx) => (
                      <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fafafa" }}>
                        <div style={{ fontWeight: 900, color: "#111827" }}>{it.ok ? "✅" : "⚠️"} {it.label}</div>
                        {!it.ok && it.hint && (<div style={{ marginTop: 4, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{it.hint}</div>)}
                      </div>
                    ))}
                  </div>
                  {checkResult.missing.length > 0 && (<div style={{ marginTop: 10, borderRadius: 12, padding: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 13, lineHeight: 1.5 }}><div style={{ fontWeight: 900, marginBottom: 4 }}>지금 보강하면 좋은 항목</div><ul style={{ margin: 0, paddingLeft: 18 }}>{checkResult.missing.slice(0, 8).map((m, i) => (<li key={i}>{m}</li>))}</ul></div>)}
                </div>
              )}
            </div>
          </section>

          {result && (
            <section style={{ marginTop: 18, border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>결과</h2>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13, color: "#111827" }}>{result}</pre>
            </section>
          )}

          <section style={{ marginTop: 18, border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>최근 저장된 복기 (최대 {FREE_HISTORY_LIMIT}개)</h2>
              <button onClick={clearHistoryAll} disabled={history.length === 0} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: history.length === 0 ? "not-allowed" : "pointer", opacity: history.length === 0 ? 0.5 : 1 }} title={history.length === 0 ? "저장된 기록이 없습니다." : "전체 삭제"}>전체 삭제</button>
            </div>
            {history.length === 0 ? (<p style={{ color: "#6b7280", marginTop: 10 }}>아직 저장된 복기가 없습니다. 리포트를 생성하면 자동으로 저장됩니다.</p>) : (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900, color: "#111827" }}>[{TAB_LABEL[h.tradeType]}] {h.ticker} / Entry {h.entryPrice}{h.stopLoss != null ? ` / SL ${h.stopLoss}` : " / SL N/A"}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => loadHistoryItem(h)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer" }} title="불러오기">불러오기</button>
                        <button onClick={() => exportHistoryItem(h)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "white", fontWeight: 900, cursor: "pointer" }} title="텍스트로 내보내기(복사)">내보내기</button>
                        <button onClick={() => removeHistory(h.id)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" }} title="삭제">삭제</button>
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{formatDateTime(h.createdAt)}</div>
                    <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}><div style={{ fontWeight: 900, marginBottom: 4 }}>메모 요약</div>{short(h.reasonNote || "(메모 없음)", 120)}</div>
                    <div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}><div style={{ fontWeight: 900, marginBottom: 4 }}>결과 요약</div>{short(h.result || "(결과 없음)", 140)}</div>
                    {h.checklist?.length ? (<div style={{ color: "#374151", fontSize: 13, lineHeight: 1.5 }}><div style={{ fontWeight: 900, marginBottom: 4 }}>규칙 체크</div><div style={{ display: "grid", gap: 4 }}>{h.checklist.slice(0, 5).map((c) => (<div key={c.id} style={{ color: "#6b7280" }}>{c.checked ? "✅" : "⬜"} {c.text}</div>))}</div></div>) : null}
                  </div>
                ))}
              </div>
            )}
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>* 무료 버전은 기기(브라우저) 내부 저장(localStorage)이라, 브라우저 데이터 삭제/기기 변경 시 기록이 사라질 수 있습니다.</p>
          </section>
        </>
      )}
    </main>
  );
}