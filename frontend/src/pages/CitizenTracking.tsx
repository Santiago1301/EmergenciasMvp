import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchReportStatus } from "../lib/api";
import { getDeviceId } from "../lib/deviceId";
import { getReportHistory, type SavedReport } from "../lib/reportHistory";
import { REPORT_TYPE_LABELS, type ReportOut, type ReportType } from "../lib/types";

const STATUS_STEPS = ["recibido", "despachado", "en_proceso", "resuelto"] as const;

const STATUS_INFO: Record<string, { label: string; description: string }> = {
  recibido: { label: "Recibido", description: "Tu reporte fue registrado en el sistema." },
  despachado: { label: "Despachado", description: "Se asigno una cuadrilla de respuesta." },
  en_proceso: { label: "En proceso", description: "La cuadrilla esta atendiendo la emergencia." },
  resuelto: { label: "Resuelto", description: "La emergencia fue atendida." },
  descartado: { label: "Descartado", description: "El reporte fue descartado por un operador." },
};

export function CitizenTracking() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<ReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [history] = useState<SavedReport[]>(() => getReportHistory());

  const loadStatus = useCallback(async () => {
    if (!reportId) return;
    try {
      const data = await fetchReportStatus(reportId, getDeviceId());
      setReport(data);
      setError(null);
    } catch {
      setError("No se pudo consultar el estado del reporte.");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const currentStepIndex = report
    ? STATUS_STEPS.indexOf(report.status as typeof STATUS_STEPS[number])
    : -1;
  const isDiscarded = report?.status === "descartado";
  const isResolved = report?.status === "resuelto";

  return (
    <div style={{ maxWidth: 400, margin: "24px auto", padding: "0 12px" }}>
      <div style={{ background: "var(--surface-1)", borderRadius: 24, padding: 12 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 16, padding: "18px 16px" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Seguimiento</p>
            <Link to="/" style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "none" }}>
              Nuevo reporte
            </Link>
          </div>

          {loading && <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>Cargando...</p>}

          {error && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 13, color: "var(--danger-text)", marginBottom: 12 }}>{error}</p>
              <button onClick={loadStatus} style={{ fontSize: 13, padding: "8px 16px" }}>Reintentar</button>
            </div>
          )}

          {report && !loading && (
            <>
              {/* Report header */}
              <div style={{
                background: "var(--surface-1)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {REPORT_TYPE_LABELS[report.report_type as ReportType] || report.report_type}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: isResolved ? "var(--success-bg)" : isDiscarded ? "var(--danger-bg)" : "var(--accent-bg)",
                    color: isResolved ? "var(--success-text)" : isDiscarded ? "var(--danger-text)" : "var(--accent-text)",
                  }}>
                    {STATUS_INFO[report.status]?.label || report.status}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  Folio: {report.id.slice(0, 8)}...
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Prioridad: P{report.priority} &middot; {new Date(report.created_at).toLocaleString("es-CO")}
                </p>
              </div>

              {/* Status timeline */}
              {!isDiscarded && (
                <div style={{ padding: "0 4px", marginBottom: 16 }}>
                  {STATUS_STEPS.map((step, i) => {
                    const isDone = currentStepIndex >= i;
                    const isCurrent = currentStepIndex === i;
                    const info = STATUS_INFO[step];
                    return (
                      <div key={step} style={{ display: "flex", gap: 12 }}>
                        {/* Vertical line + dot */}
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          width: 20,
                          flexShrink: 0,
                        }}>
                          <div style={{
                            width: isCurrent ? 14 : 10,
                            height: isCurrent ? 14 : 10,
                            borderRadius: "50%",
                            background: isDone ? "var(--accent-text)" : "var(--border)",
                            border: isCurrent ? "3px solid var(--accent-bg)" : "none",
                            flexShrink: 0,
                            marginTop: 4,
                          }} />
                          {i < STATUS_STEPS.length - 1 && (
                            <div style={{
                              width: 2,
                              flex: 1,
                              minHeight: 24,
                              background: currentStepIndex > i ? "var(--accent-text)" : "var(--border)",
                            }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ paddingBottom: i < STATUS_STEPS.length - 1 ? 14 : 0 }}>
                          <p style={{
                            fontSize: 13,
                            fontWeight: isCurrent ? 600 : 400,
                            color: isDone ? "var(--text-primary)" : "var(--text-muted)",
                            margin: 0,
                            lineHeight: 1.3,
                          }}>
                            {info.label}
                          </p>
                          {isCurrent && (
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0", lineHeight: 1.4 }}>
                              {info.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isDiscarded && (
                <div style={{
                  background: "var(--danger-bg, #fde2e4)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}>
                  <p style={{ fontSize: 13, color: "var(--danger-text, #c1121f)", margin: 0 }}>
                    {STATUS_INFO.descartado.description}
                  </p>
                </div>
              )}

              {!isResolved && !isDiscarded && (
                <p style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  margin: "0 0 8px",
                }}>
                  Se actualiza automaticamente cada 5 segundos
                </p>
              )}
            </>
          )}

          {/* Report history */}
          {history.length > 0 && (
            <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 14, marginTop: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
                Mis reportes anteriores
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.slice(0, 5).map((saved) => (
                  <Link
                    key={saved.id}
                    to={`/seguimiento/${saved.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                      color: saved.id === reportId ? "var(--accent-text)" : "var(--text-secondary)",
                      textDecoration: "none",
                      padding: "6px 10px",
                      background: saved.id === reportId ? "var(--accent-bg)" : "var(--surface-1)",
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontWeight: saved.id === reportId ? 600 : 400 }}>
                      {REPORT_TYPE_LABELS[saved.report_type as ReportType] || saved.report_type}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {saved.id.slice(0, 8)}...
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
