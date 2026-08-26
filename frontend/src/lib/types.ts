export type ReportType = "rescate" | "medico" | "estructural" | "preventivo";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  rescate: "Rescate critico",
  medico: "Atención medica",
  estructural: "Daño estructural",
  preventivo: "Evaluación preventiva",
};

export interface ReportDraft {
  reportType: ReportType;
  description: string;
  lat: number;
  lon: number;
  deviceId: string;
  idempotencyKey: string;
  contactPhone?: string;
}

export interface ReportOut {
  id: string;
  report_type: ReportType;
  priority: 1 | 2 | 3 | 4;
  status: string;
  zone_id: string | null;
  created_at: string;
}

export interface ClusterRow {
  id: string;
  zone_id: string;
  cluster_label: number;
  lat: number;
  lon: number;
  report_count: number;
  priority_score: number;
}

export interface ReportRow {
  id: string;
  report_type: ReportType;
  priority: 1 | 2 | 3 | 4;
  status: string;
  zone_id: string;
  created_at: string;
  lat: number;
  lon: number;
  description?: string;
  contact_phone?: string;
}

export interface CrewRow {
  id: string;
  zone_id: string;
  name: string;
  crew_type: string;
  status: string;
}

export const CREW_TYPE_LABELS: Record<string, string> = {
  rescate: "Rescate / Escombros",
  medico: "Atencion Medica",
  bomberos: "Bomberos / Incendios",
  estructural: "Evaluacion Estructural",
};

export const CREW_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  en_ruta: "En ruta",
  ocupado: "Ocupado",
  fuera_servicio: "Fuera de servicio",
};

export interface Zone {
  id: string;
  name: string;
}
