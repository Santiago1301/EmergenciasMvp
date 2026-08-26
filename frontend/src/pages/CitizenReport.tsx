import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { submitReport } from "../lib/api";
import { getDeviceId } from "../lib/deviceId";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { enqueueReport } from "../lib/offlineQueue";
import { saveReport } from "../lib/reportHistory";
import { REPORT_TYPE_LABELS, type ReportDraft, type ReportType } from "../lib/types";

type ViewState = "form" | "sending" | "queued" | "error";

const EMERGENCY_TIPS: Record<ReportType, { title: string; tips: string[] }> = {
  rescate: {
    title: "Consejos durante un rescate",
    tips: [
      "Mantente en un lugar seguro y no intentes mover escombros pesados sin ayuda profesional.",
      "Si estas atrapado, golpea superficies duras de forma ritmica para que los rescatistas te localicen.",
      "Cubre tu boca y nariz con tela para evitar inhalar polvo o particulas.",
      "No enciendas fuego ni cerillas: puede haber fugas de gas.",
      "Conserva la bateria de tu celular, usalo solo para emergencias.",
    ],
  },
  medico: {
    title: "Primeros auxilios basicos",
    tips: [
      "Aplica presion directa sobre heridas con sangrado usando un trapo limpio.",
      "No muevas a personas con posibles fracturas de columna o cuello.",
      "Eleva las piernas de una persona en shock y cubrela con algo caliente.",
      "En caso de quemadura, enfria la zona con agua limpia durante al menos 10 minutos.",
      "Manten a la persona consciente hablando, no le des comida ni agua si esta inconsciente.",
    ],
  },
  estructural: {
    title: "Seguridad ante dano estructural",
    tips: [
      "Evacua el edificio si observas grietas grandes, inclinacion o sonidos de crujido.",
      "No uses ascensores: utiliza las escaleras.",
      "Alejate de ventanas, balcones y paredes exteriores danadas.",
      "Cierra las llaves de gas y agua antes de salir si es posible hacerlo con seguridad.",
      "No regreses al edificio hasta que un equipo profesional lo autorice.",
    ],
  },
  preventivo: {
    title: "Preparacion y prevencion",
    tips: [
      "Ten un kit de emergencia con agua, comida no perecedera, linterna y radio de pilas.",
      "Identifica las rutas de evacuacion y puntos de encuentro de tu zona.",
      "Manten a la mano documentos de identidad y medicamentos esenciales.",
      "Almacena al menos 3 litros de agua por persona por dia para 72 horas.",
      "Comparte este plan con tu familia y practica simulacros periodicamente.",
    ],
  },
};

const RIESGO_OPTIONS = ["Fuga de gas", "Fuego / incendio", "Derrumbe activo", "Inundacion"];
const EDIFICACION_OPTIONS = ["Residencial", "Comercial", "Educativo", "Hospitalario", "Puente / via", "Otro"];
const AGRIETAMIENTO_OPTIONS = ["Leve (fisuras superficiales)", "Moderado (grietas visibles)", "Severo (riesgo de colapso)"];
const INSUMO_OPTIONS = ["Agua potable", "Raciones de campana", "Kit primeros auxilios", "Medicamentos cronicos", "Cobijas / abrigo", "Otro"];

export function CitizenReport() {
  const isOnline = useOnlineStatus();
  const { pendingCount } = useOfflineSync();

  const [reportType, setReportType] = useState<ReportType>("rescate");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [state, setState] = useState<ViewState>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const [personasAtrapadas, setPersonasAtrapadas] = useState("");
  const [personasHeridas, setPersonasHeridas] = useState("");
  const [riesgos, setRiesgos] = useState<string[]>([]);
  const [adultos, setAdultos] = useState("");
  const [ninos, setNinos] = useState("");
  const [terceraEdad, setTerceraEdad] = useState("");
  const [accesibilidad, setAccesibilidad] = useState(false);
  const [tipoEdificacion, setTipoEdificacion] = useState("");
  const [nivelAgrietamiento, setNivelAgrietamiento] = useState("");
  const [riesgoVias, setRiesgoVias] = useState(false);
  const [categoriaInsumo, setCategoriaInsumo] = useState("");

  function buildDescription(): string {
    const parts: string[] = [];

    if (reportType === "rescate") {
      if (personasAtrapadas) parts.push(`Personas atrapadas: ${personasAtrapadas}`);
      if (personasHeridas) parts.push(`Personas heridas: ${personasHeridas}`);
      if (riesgos.length > 0) parts.push(`Riesgo inminente: ${riesgos.join(", ")}`);
    } else if (reportType === "medico") {
      const conteo = [];
      if (adultos) conteo.push(`${adultos} adultos`);
      if (ninos) conteo.push(`${ninos} niños`);
      if (terceraEdad) conteo.push(`${terceraEdad} tercera edad`);
      if (conteo.length > 0) parts.push(`Damnificados: ${conteo.join(", ")}`);
      if (accesibilidad) parts.push("Requiere accesibilidad especial");
    } else if (reportType === "estructural") {
      if (tipoEdificacion) parts.push(`Edificacion: ${tipoEdificacion}`);
      if (nivelAgrietamiento) parts.push(`Agrietamiento: ${nivelAgrietamiento}`);
      if (riesgoVias) parts.push("Riesgo de colapso sobre vias");
    } else if (reportType === "preventivo") {
      if (categoriaInsumo) parts.push(`Insumo requerido: ${categoriaInsumo}`);
    }

    if (description.trim()) parts.push(description.trim());
    return parts.join(". ") || description;
  }

  function handleTypeChange(type: ReportType) {
    setReportType(type);
    setPersonasAtrapadas("");
    setPersonasHeridas("");
    setRiesgos([]);
    setAdultos("");
    setNinos("");
    setTerceraEdad("");
    setAccesibilidad(false);
    setTipoEdificacion("");
    setNivelAgrietamiento("");
    setRiesgoVias(false);
    setCategoriaInsumo("");
  }

  function toggleRiesgo(r: string) {
    setRiesgos((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setErrorMessage(null);

    const position = await getCurrentPosition().catch(() => null);
    if (!position) {
      setErrorMessage("No se pudo obtener tu ubicacion. Activa el GPS e intenta de nuevo.");
      setState("error");
      return;
    }

    const fullDescription = buildDescription();

    const draft: ReportDraft = {
      reportType,
      description: fullDescription,
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      deviceId: getDeviceId(),
      idempotencyKey: crypto.randomUUID(),
      contactPhone: contactPhone || undefined,
    };

    if (!isOnline) {
      await enqueueReport(draft);
      setState("queued");
      return;
    }

    try {
      const result = await submitReport(draft);
      saveReport(result);
      navigate(`/seguimiento/${result.id}`);
      return;
    } catch {
      await enqueueReport(draft);
      setState("queued");
    }
  }

  const hasRequiredFields = (() => {
    if (reportType === "rescate") return personasAtrapadas !== "" || personasHeridas !== "" || description.trim().length > 0;
    if (reportType === "medico") return adultos !== "" || ninos !== "" || terceraEdad !== "" || description.trim().length > 0;
    if (reportType === "estructural") return tipoEdificacion !== "" || description.trim().length > 0;
    if (reportType === "preventivo") return categoriaInsumo !== "" || description.trim().length > 0;
    return description.trim().length > 0;
  })();

  if (state === "queued") {
    return (
      <Screen>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>Reporte guardado</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Se enviara automaticamente en cuanto vuelva la señal.
          </p>
          <button className="primary" style={{ width: "100%" }} onClick={() => setState("form")}>
            Reportar otra emergencia
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Reportar emergencia</p>
          <ConnectionBadge isOnline={isOnline} pendingCount={pendingCount} />
        </div>

        <label htmlFor="report_type">Tipo de emergencia</label>
        <select
          id="report_type"
          value={reportType}
          onChange={(e) => handleTypeChange(e.target.value as ReportType)}
          style={{ width: "100%", marginBottom: 14 }}
        >
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
            <option key={type} value={type}>
              {REPORT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        {reportType === "rescate" && (
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Datos criticos de rescate</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label htmlFor="atrapadas" style={{ fontSize: 12 }}>Personas atrapadas</label>
                <input id="atrapadas" type="number" min="0" value={personasAtrapadas} onChange={(e) => setPersonasAtrapadas(e.target.value)} style={{ width: "100%" }} placeholder="0" />
              </div>
              <div>
                <label htmlFor="heridas" style={{ fontSize: 12 }}>Personas heridas</label>
                <input id="heridas" type="number" min="0" value={personasHeridas} onChange={(e) => setPersonasHeridas(e.target.value)} style={{ width: "100%" }} placeholder="0" />
              </div>
            </div>
            <label style={{ fontSize: 12 }}>Riesgo inminente</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {RIESGO_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRiesgo(r)}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: riesgos.includes(r) ? "var(--danger-bg, #fde2e4)" : "transparent",
                    color: riesgos.includes(r) ? "var(--danger-text, #c1121f)" : "var(--text-secondary)",
                    fontWeight: riesgos.includes(r) ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {reportType === "medico" && (
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Conteo de damnificados</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label htmlFor="adultos" style={{ fontSize: 12 }}>Adultos</label>
                <input id="adultos" type="number" min="0" value={adultos} onChange={(e) => setAdultos(e.target.value)} style={{ width: "100%" }} placeholder="0" />
              </div>
              <div>
                <label htmlFor="ninos" style={{ fontSize: 12 }}>Ninos</label>
                <input id="ninos" type="number" min="0" value={ninos} onChange={(e) => setNinos(e.target.value)} style={{ width: "100%" }} placeholder="0" />
              </div>
              <div>
                <label htmlFor="tercera" style={{ fontSize: 12 }}>Tercera edad</label>
                <input id="tercera" type="number" min="0" value={terceraEdad} onChange={(e) => setTerceraEdad(e.target.value)} style={{ width: "100%" }} placeholder="0" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={accesibilidad} onChange={(e) => setAccesibilidad(e.target.checked)} />
              Requiere accesibilidad especial (silla de ruedas, camilla)
            </label>
          </div>
        )}

        {reportType === "estructural" && (
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Evaluacion de dano</p>
            <label htmlFor="edificacion" style={{ fontSize: 12 }}>Tipo de edificacion</label>
            <select id="edificacion" value={tipoEdificacion} onChange={(e) => setTipoEdificacion(e.target.value)} style={{ width: "100%", marginBottom: 10 }}>
              <option value="">-- Seleccionar --</option>
              {EDIFICACION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <label htmlFor="agrietamiento" style={{ fontSize: 12 }}>Nivel de agrietamiento</label>
            <select id="agrietamiento" value={nivelAgrietamiento} onChange={(e) => setNivelAgrietamiento(e.target.value)} style={{ width: "100%", marginBottom: 10 }}>
              <option value="">-- Seleccionar --</option>
              {AGRIETAMIENTO_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={riesgoVias} onChange={(e) => setRiesgoVias(e.target.checked)} />
              Riesgo de colapso sobre vias publicas
            </label>
          </div>
        )}

        {reportType === "preventivo" && (
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Suministros requeridos</p>
            <label htmlFor="insumo" style={{ fontSize: 12 }}>Categoria de insumo</label>
            <select id="insumo" value={categoriaInsumo} onChange={(e) => setCategoriaInsumo(e.target.value)} style={{ width: "100%", marginBottom: 4 }}>
              <option value="">-- Seleccionar --</option>
              {INSUMO_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}

        <label>Ubicacion</label>
        <p style={{ fontSize: 13, color: "var(--accent-text)", marginTop: 0, marginBottom: 14 }}>
          Se detecta automaticamente por GPS al enviar
        </p>

        <label htmlFor="description">Descripcion adicional</label>
        <textarea
          id="description"
          rows={2}
          placeholder="Detalles adicionales (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
        />

        <label htmlFor="phone">Telefono de contacto (opcional)</label>
        <input
          id="phone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
        />

        {errorMessage && (
          <p style={{ fontSize: 13, color: "var(--danger-text)", marginBottom: 12 }}>{errorMessage}</p>
        )}

        <button
          type="submit"
          className="primary"
          style={{ width: "100%" }}
          disabled={state === "sending" || !hasRequiredFields}
        >
          {state === "sending" ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>

      <EmergencyTips type={reportType} />
    </Screen>
  );
}

function ConnectionBadge({ isOnline, pendingCount }: { isOnline: boolean; pendingCount: number }) {
  if (!isOnline) {
    return <span className="badge" style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>Sin conexion</span>;
  }
  if (pendingCount > 0) {
    return (
      <span className="badge" style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}>
        Sincronizando {pendingCount}
      </span>
    );
  }
  return <span className="badge" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>En linea</span>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 400, margin: "24px auto", background: "var(--surface-1)", borderRadius: 24, padding: 12 }}>
      <div style={{ background: "var(--surface-2)", borderRadius: 16, padding: "18px 16px" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
        <Link to="/operador/login" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          Acceso operador
        </Link>
        {localStorage.getItem("emergencias_my_reports") && (
          <Link
            to={`/seguimiento/${JSON.parse(localStorage.getItem("emergencias_my_reports") || "[]")[0]?.id || ""}`}
            style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "none" }}
          >
            Mis reportes
          </Link>
        )}
      </div>
    </div>
  );
}

function EmergencyTips({ type }: { type: ReportType }) {
  const { title, tips } = EMERGENCY_TIPS[type];
  return (
    <div style={{
      marginTop: 16,
      borderTop: "0.5px solid var(--border)",
      paddingTop: 14,
    }}>
      <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px" }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}>
            <span style={{
              flexShrink: 0,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--accent-bg)",
              color: "var(--accent-text)",
              fontSize: 10,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 1,
            }}>
              {i + 1}
            </span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocalizacion no disponible"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}
