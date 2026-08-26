import { useCallback, useEffect, useState } from "react";
import { EmergencyMap } from "../components/EmergencyMap";
import { PRIORITY_COLORS } from "../lib/priorityColors";
import { supabase } from "../lib/supabaseClient";
import type { ClusterRow, CrewRow, ReportRow, Zone } from "../lib/types";
import { REPORT_TYPE_LABELS, CREW_TYPE_LABELS, CREW_STATUS_LABELS, type ReportType } from "../lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const ZONE_CENTERS: Record<string, [number, number]> = {
  Quibdo: [5.6947, -76.6413],
  Pereira: [4.8087, -75.6946],
  Cali: [3.4516, -76.532],
  Manizales: [5.0703, -75.5138],
};

const OTHER_ZONE_ID = "__other__";
const COLOMBIA_CENTER: [number, number] = [4.5709, -74.2973];

const ACTIVE_STATUSES = ["recibido", "despachado", "en_proceso"];

const STATUS_LABELS: Record<string, string> = {
  recibido: "Recibido",
  despachado: "Despachado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

const ASSIGNMENT_ACTIONS: Record<string, { next: string; label: string }[]> = {
  asignado: [{ next: "en_ruta", label: "En ruta" }],
  en_ruta: [{ next: "en_sitio", label: "En sitio" }],
  en_sitio: [{ next: "completado", label: "Completar" }],
};

const FINALIZE_CHAIN: Record<string, string[]> = {
  asignado: ["en_ruta", "en_sitio", "completado"],
  en_ruta: ["en_sitio", "completado"],
  en_sitio: ["completado"],
};

export function OperatorDashboard() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [allCrews, setAllCrews] = useState<CrewRow[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCrewForAssign, setSelectedCrewForAssign] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, { id: string; crew_name: string; crew_type: string; status: string }>>({});
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("zones")
      .select("id,name")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setZones(data);
          setSelectedZone((current) => current || data[0].id);
        }
      });
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedZone) return;

    const isOther = selectedZone === OTHER_ZONE_ID;

    let reportsQuery = supabase
      .from("reports_view")
      .select("*")
      .in("status", ACTIVE_STATUSES)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (isOther) {
      reportsQuery = reportsQuery.is("zone_id", null);
    } else {
      reportsQuery = reportsQuery.eq("zone_id", selectedZone);
    }

    const crewsQuery = isOther
      ? supabase.from("crews").select("id,zone_id,name,crew_type,status")
      : supabase.from("crews").select("id,zone_id,name,crew_type,status").eq("zone_id", selectedZone);

    const clustersQuery = isOther
      ? Promise.resolve({ data: [] as ClusterRow[] })
      : supabase.from("clusters_view").select("*").eq("zone_id", selectedZone);

    const [reportsRes, clustersRes, crewsRes] = await Promise.all([
      reportsQuery,
      clustersQuery,
      crewsQuery,
    ]);

    const loadedReports = reportsRes.data ?? [];
    setReports(loadedReports);
    setClusters(clustersRes.data ?? []);
    setCrews(crewsRes.data ?? []);

    const dispatchedIds = loadedReports.filter((r) => r.status === "despachado" || r.status === "en_proceso").map((r) => r.id);
    if (dispatchedIds.length > 0) {
      const { data: assignData } = await supabase
        .from("dispatch_assignments")
        .select("id, report_id, status, crews(name, crew_type)")
        .in("report_id", dispatchedIds)
        .not("status", "in", "(completado,cancelado)");
      if (assignData) {
        const map: Record<string, { id: string; crew_name: string; crew_type: string; status: string }> = {};
        for (const a of assignData) {
          const crew = a.crews as unknown as { name: string; crew_type: string } | null;
          map[a.report_id] = {
            id: a.id,
            crew_name: crew?.name ?? "Desconocida",
            crew_type: crew?.crew_type ?? "",
            status: a.status,
          };
        }
        setAssignments(map);
      }
    } else {
      setAssignments({});
    }
  }, [selectedZone]);

  useEffect(() => {
    if (!selectedZone) return;

    loadData();

    const isOtherZone = selectedZone === OTHER_ZONE_ID;

    if (!isOtherZone) {
      const channel = supabase
        .channel(`zone-${selectedZone}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "reports", filter: `zone_id=eq.${selectedZone}` }, loadData)
        .on("postgres_changes", { event: "*", schema: "public", table: "clusters", filter: `zone_id=eq.${selectedZone}` }, loadData)
        .on("postgres_changes", { event: "*", schema: "public", table: "crews", filter: `zone_id=eq.${selectedZone}` }, loadData)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const channel = supabase
      .channel("other-zones")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedZone, loadData]);

  useEffect(() => {
    supabase
      .from("crews")
      .select("id,zone_id,name,crew_type,status")
      .then(({ data }) => setAllCrews(data ?? []));
  }, []);

  const isOtherZone = selectedZone === OTHER_ZONE_ID;
  const zoneName = isOtherZone ? "Otras zonas" : zones.find((z) => z.id === selectedZone)?.name;
  const center: [number, number] = isOtherZone
    ? COLOMBIA_CENTER
    : (zoneName && ZONE_CENTERS[zoneName as string]) || [4.5, -75.7];
  const mapZoom = isOtherZone ? 6 : 12;

  const displayCrews = isOtherZone ? allCrews : crews;
  const availableCrews = displayCrews.filter((c) => c.status === "disponible");

  async function handleAssign(reportId: string) {
    const crewId = selectedCrewForAssign[reportId];
    if (!crewId) {
      alert("Selecciona una cuadrilla primero");
      return;
    }

    setAssigningId(reportId);
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${reportId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew_id: crewId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo asignar la cuadrilla");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleUpdateAssignment(assignmentId: string, newStatus: string) {
    setUpdatingAssignment(assignmentId);
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${assignmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    } finally {
      setUpdatingAssignment(null);
    }
  }

  async function handleFinalize(assignmentId: string) {
    setUpdatingAssignment(assignmentId);
    try {
      const { data: current } = await supabase
        .from("dispatch_assignments")
        .select("status")
        .eq("id", assignmentId)
        .single();

      const steps = FINALIZE_CHAIN[current?.status ?? ""] ?? [];
      if (steps.length === 0) return;

      for (const step of steps) {
        const response = await fetch(`${API_BASE_URL}/dispatch/${assignmentId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: step }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
          throw new Error(err.detail || `HTTP ${response.status}`);
        }
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo finalizar");
    } finally {
      setUpdatingAssignment(null);
    }
  }

  async function handleCancelAssignment(assignmentId: string) {
    if (!confirm("¿Cancelar esta asignacion? La cuadrilla volvera a estar disponible.")) return;
    await handleUpdateAssignment(assignmentId, "cancelado");
  }

  function handleLogout() {
    supabase.auth.signOut().then(() => {
      window.location.href = "/operador/login";
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 14,
        }}
      >
        <div>
          <p style={{ fontWeight: 500, fontSize: 16, margin: 0 }}>Emergencias {zoneName ? `· ${zoneName}` : ""}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
            {reports.length} reportes activos &middot; {availableCrews.length} cuadrillas disponibles
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} style={{ width: 160 }}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
            <option value={OTHER_ZONE_ID}>Otras zonas</option>
          </select>
          <button onClick={handleLogout} style={{ fontSize: 12, padding: "6px 12px" }}>Salir</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 16 }}>
        <EmergencyMap center={center} zoom={mapZoom} reports={reports} clusters={clusters} selectedReportId={selectedReportId} onSelectReport={setSelectedReportId} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflow: "auto" }}>
          {reports.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin reportes activos en esta zona.</p>
          )}
          {reports.map((report) => {
            const colors = PRIORITY_COLORS[report.priority];
            const isSelected = selectedReportId === report.id;
            return (
              <div
                key={report.id}
                onClick={() => setSelectedReportId(report.id === selectedReportId ? null : report.id)}
                style={{
                  border: isSelected ? `2px solid ${colors.fill}` : "0.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: isSelected ? colors.bg : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="badge" style={{ background: colors.bg, color: colors.text, fontWeight: 600 }}>
                      {colors.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {REPORT_TYPE_LABELS[report.report_type as ReportType] || report.report_type}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(report.created_at)}</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "4px 0", lineHeight: 1.4 }}>
                  {report.description || "Sin descripcion"}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface-1)", padding: "2px 6px", borderRadius: 4 }}>
                    {STATUS_LABELS[report.status] || report.status}
                  </span>
                  {report.contact_phone && (
                    <span style={{ fontSize: 11, color: "var(--accent-text)" }}>
                      Tel: {report.contact_phone}
                    </span>
                  )}
                  {!report.zone_id && (
                    <span className="badge" style={{ background: "var(--warning-bg)", color: "var(--warning-text)", fontSize: 10 }}>
                      Fuera de zona
                    </span>
                  )}
                </div>

                {(report.status === "recibido" || report.status === "validado") && (
                  <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={selectedCrewForAssign[report.id] || ""}
                      onChange={(e) => setSelectedCrewForAssign((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      style={{ width: "100%", marginBottom: 6, fontSize: 12 }}
                    >
                      <option value="">-- Seleccionar cuadrilla --</option>
                      {availableCrews.map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {crew.name} ({CREW_TYPE_LABELS[crew.crew_type] || crew.crew_type})
                        </option>
                      ))}
                    </select>
                    <button
                      style={{ width: "100%", fontSize: 13 }}
                      disabled={assigningId === report.id || !selectedCrewForAssign[report.id]}
                      onClick={() => handleAssign(report.id)}
                    >
                      {assigningId === report.id ? "Asignando..." : "Despachar cuadrilla"}
                    </button>
                  </div>
                )}

                {report.status === "despachado" && assignments[report.id] && (
                  <div style={{ marginTop: 8, background: "var(--surface-1)", borderRadius: 8, padding: "8px 10px" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CrewTypeIcon type={assignments[report.id].crew_type} />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{assignments[report.id].crew_name}</span>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--warning-bg)",
                        color: "var(--warning-text)",
                      }}>
                        {CREW_STATUS_LABELS[assignments[report.id].status] || assignments[report.id].status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(ASSIGNMENT_ACTIONS[assignments[report.id].status] || []).map((action) => (
                        <button
                          key={action.next}
                          style={{ flex: 1, fontSize: 12, padding: "6px 0" }}
                          disabled={updatingAssignment === assignments[report.id].id}
                          onClick={() => handleUpdateAssignment(assignments[report.id].id, action.next)}
                        >
                          {updatingAssignment === assignments[report.id].id ? "..." : action.label}
                        </button>
                      ))}
                      <button
                        style={{ flex: 1, fontSize: 12, padding: "6px 0", background: "var(--success-bg)", color: "var(--success-text)", fontWeight: 600 }}
                        disabled={updatingAssignment === assignments[report.id].id}
                        onClick={() => handleFinalize(assignments[report.id].id)}
                      >
                        {updatingAssignment === assignments[report.id].id ? "..." : "Finalizar"}
                      </button>
                      <button
                        style={{ fontSize: 12, padding: "6px 10px", background: "var(--danger-bg, #fde2e4)", color: "var(--danger-text, #c1121f)" }}
                        disabled={updatingAssignment === assignments[report.id].id}
                        onClick={() => handleCancelAssignment(assignments[report.id].id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20, borderTop: "0.5px solid var(--border)", paddingTop: 16 }}>
        <p style={{ fontWeight: 500, fontSize: 15, margin: "0 0 12px" }}>
          Cuadrillas {isOtherZone ? "- Todas las zonas" : `- ${zoneName}`}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {displayCrews.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay cuadrillas registradas.</p>
          )}
          {displayCrews.map((crew) => {
            const isAvailable = crew.status === "disponible";
            const crewZoneName = zones.find((z) => z.id === crew.zone_id)?.name;
            return (
              <div
                key={crew.id}
                style={{
                  border: "0.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "12px 14px",
                  background: isAvailable ? "var(--surface-2)" : "var(--surface-1)",
                  opacity: isAvailable ? 1 : 0.7,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{crew.name}</span>
                  <span
                    className="badge"
                    style={{
                      background: isAvailable ? "var(--success-bg)" : crew.status === "en_ruta" ? "var(--warning-bg)" : "var(--surface-1)",
                      color: isAvailable ? "var(--success-text)" : crew.status === "en_ruta" ? "var(--warning-text)" : "var(--text-muted)",
                    }}
                  >
                    {CREW_STATUS_LABELS[crew.status] || crew.status}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CrewTypeIcon type={crew.crew_type} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {CREW_TYPE_LABELS[crew.crew_type] || crew.crew_type}
                    </span>
                  </div>
                  {isOtherZone && crewZoneName && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{crewZoneName}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CrewTypeIcon({ type }: { type: string }) {
  const labels: Record<string, string> = {
    rescate: "R",
    medico: "M",
    bomberos: "B",
    estructural: "E",
  };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "var(--accent-bg)",
      color: "var(--accent-text)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {labels[type] || "?"}
    </span>
  );
}

function timeAgo(isoDate: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}
