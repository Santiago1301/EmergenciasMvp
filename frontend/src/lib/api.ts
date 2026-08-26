import type { ReportDraft, ReportOut } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export async function submitReport(draft: ReportDraft): Promise<ReportOut> {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report_type: draft.reportType,
      description: draft.description,
      lat: draft.lat,
      lon: draft.lon,
      device_id: draft.deviceId,
      idempotency_key: draft.idempotencyKey,
      contact_phone: draft.contactPhone || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo enviar el reporte (HTTP ${response.status})`);
  }

  return response.json();
}

export async function fetchReportStatus(reportId: string, deviceId: string): Promise<ReportOut> {
  const response = await fetch(
    `${API_BASE_URL}/reports/${reportId}/status?device_id=${encodeURIComponent(deviceId)}`
  );
  if (!response.ok) {
    throw new Error(`No se pudo consultar el estado (HTTP ${response.status})`);
  }
  return response.json();
}
