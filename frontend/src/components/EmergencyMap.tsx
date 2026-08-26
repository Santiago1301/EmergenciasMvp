import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { PRIORITY_COLORS } from "../lib/priorityColors";
import { REPORT_TYPE_LABELS, type ClusterRow, type ReportRow, type ReportType } from "../lib/types";

interface Props {
  center: [number, number];
  zoom?: number;
  reports: ReportRow[];
  clusters: ClusterRow[];
  selectedReportId?: string | null;
  onSelectReport?: (id: string | null) => void;
}

function FlyToSelected({ center, zoom, reports, selectedReportId }: { center: [number, number]; zoom: number; reports: ReportRow[]; selectedReportId?: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedReportId) {
      const report = reports.find((r) => r.id === selectedReportId);
      if (report) {
        map.flyTo([report.lat, report.lon], 15, { duration: 0.8 });
        return;
      }
    }
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [selectedReportId, center, zoom, reports, map]);

  return null;
}

export function EmergencyMap({ center, zoom = 12, reports, clusters, selectedReportId, onSelectReport }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: 500, width: "100%", borderRadius: "var(--radius)" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyToSelected center={center} zoom={zoom} reports={reports} selectedReportId={selectedReportId} />

      {clusters.map((cluster) => (
        <CircleMarker
          key={cluster.id}
          center={[cluster.lat, cluster.lon]}
          radius={12 + Math.min(cluster.report_count, 10)}
          pathOptions={{
            color: "#e24b4a",
            fillColor: "#e24b4a",
            fillOpacity: 0.25,
            weight: 1,
          }}
        >
          <Popup>
            <strong>Cluster</strong><br />
            {cluster.report_count} reportes agrupados
          </Popup>
        </CircleMarker>
      ))}

      {reports.map((report) => {
        const colors = PRIORITY_COLORS[report.priority];
        const isSelected = selectedReportId === report.id;
        return (
          <CircleMarker
            key={report.id}
            center={[report.lat, report.lon]}
            radius={isSelected ? 10 : 6}
            pathOptions={{
              color: isSelected ? "#1f1e1c" : colors.fill,
              fillColor: colors.fill,
              fillOpacity: isSelected ? 1 : 0.9,
              weight: isSelected ? 3 : 1,
            }}
            eventHandlers={{
              click: () => onSelectReport?.(report.id === selectedReportId ? null : report.id),
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: colors.fill }}>{colors.label}</span>
                  <span style={{ fontWeight: 500 }}>
                    {REPORT_TYPE_LABELS[report.report_type as ReportType] || report.report_type}
                  </span>
                </div>
                <p style={{ fontSize: 12, margin: "4px 0", lineHeight: 1.3 }}>
                  {report.description || "Sin descripcion"}
                </p>
                {report.contact_phone && (
                  <p style={{ fontSize: 11, margin: "4px 0 0", color: "#185fa5" }}>
                    Tel: {report.contact_phone}
                  </p>
                )}
                <p style={{ fontSize: 10, margin: "4px 0 0", color: "#6b6a63" }}>
                  {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
