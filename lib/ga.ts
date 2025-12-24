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
};

export function gaEvent(action: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;

  window.gtag("event", action, {
    event_category: "engagement",
    ...params,
  });
}
