// lib/ga.ts
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export const GA_EVENT = {
  GENERATE_REPORT: "generate_report",
  DOWNLOAD_PDF: "download_pdf",
  LOAD_HISTORY: "load_history",
  EXPORT_HISTORY: "export_history",

  // ✅ 추가: 하루 무료 제한 막힘 이벤트
  DAILY_LIMIT_BLOCKED: "daily_limit_blocked",

  // (선택) 네가 page.tsx에서 쓰는 다른 이벤트도 있으면 여기에 계속 추가하면 됨
  // GENERATE_SUCCESS: "generate_success",
  // GENERATE_FAIL: "generate_fail",
} as const;

// ✅ action을 "GA_EVENT 값들만" 받도록 타입 안전하게
export type GaEventName = (typeof GA_EVENT)[keyof typeof GA_EVENT];

export function gaEvent(action: GaEventName, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;

  window.gtag("event", action, {
    event_category: "engagement",
    ...params,
  });
}
