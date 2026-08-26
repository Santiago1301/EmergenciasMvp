import type { ReportOut } from "./types";

const STORAGE_KEY = "emergencias_my_reports";

export interface SavedReport {
  id: string;
  report_type: string;
  created_at: string;
}

export function saveReport(report: ReportOut): void {
  const history = getReportHistory();
  if (history.some((r) => r.id === report.id)) return;
  history.unshift({
    id: report.id,
    report_type: report.report_type,
    created_at: report.created_at,
  });
  if (history.length > 20) history.length = 20;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getReportHistory(): SavedReport[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
