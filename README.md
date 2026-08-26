# Emergencias MVP

Sistema de gestion de emergencias post-sismo para cuatro zonas de Colombia (Quibdo, Pereira, Cali, Manizales). Los ciudadanos reportan incidentes desde una PWA con soporte offline y los operadores despachan cuadrillas especializadas desde un dashboard con mapa interactivo y clustering geoespacial en tiempo real.

---

## Patrones arquitectonicos aplicados

| Patron | Donde se aplica |
|---|---|
| **Microservicios** | 4 servicios independientes (Intake, Dispatch, Geospatial, Notification), cada uno con su propio dominio, Dockerfile y tests |
| **API Gateway** | nginx en local / AWS API Gateway en produccion. Punto unico de entrada que rutea `/reports` a S1 y `/dispatch` a S2 |
| **Event-Driven Architecture** | `publish_event` emite eventos a EventBridge (AWS) o los loguea en local. Los servicios downstream reaccionan a eventos sin acoplamiento directo |
| **State Machine** | Transiciones explicitas para reportes (`recibido → despachado → en_proceso → resuelto`) y asignaciones (`asignado → en_ruta → en_sitio → completado`). Cualquier transicion invalida se rechaza |
| **Strangler Fig (parcial)** | El mock-organismo simula el sistema externo que se reemplazaria progresivamente. La interfaz del webhook ya esta definida |
| **Database per Concern** | Supabase (PostgreSQL + PostGIS) como unica base, pero el acceso se segmenta: los microservicios usan `service_role` key (bypasea RLS) via PostgREST/RPC, los operadores usan `anon` key con RLS por zona |
| **Offline-First (PWA)** | IndexedDB como cola offline + service worker. Los reportes se encolan localmente y se sincronizan cuando hay conexion |
| **Row-Level Security** | Cada operador solo ve y edita datos de su zona. Las politicas SQL estan en `supabase/migrations/0003_rls_policies.sql` |
| **Idempotency** | Cada reporte lleva un `idempotency_key` (UUID v4) generado en el cliente, lo que evita duplicados si la PWA reintenta un envio offline |

---

## Stack tecnologico

| Capa | Tecnologia | Justificacion |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | SPA ligera, hot-reload rapido, tipado estatico |
| PWA | VitePWA + IndexedDB (idb) | Soporte offline nativo, se instala como app en movil |
| Mapa | Leaflet + react-leaflet | Visualizacion geoespacial open-source, sin costo por tile |
| Backend | Python + FastAPI + Mangum | Async, validacion automatica con Pydantic, compatible con AWS Lambda via Mangum |
| Base de datos | Supabase (PostgreSQL 15 + PostGIS) | Realtime, Auth, RLS y funciones RPC sin infraestructura propia |
| Clustering | PostGIS ST_ClusterDBSCAN | DBSCAN ejecutado directamente en la base de datos, sin mover datos a Python |
| Eventos | AWS EventBridge (produccion) | Desacopla servicios; en local se sustituye por logging |
| Gateway | nginx (local) / API Gateway (AWS) | Ruteo centralizado, CORS, sin cambios en codigo entre entornos |
| Contenedores | Docker Compose | Orquestacion local de todos los servicios con un solo comando |

---

## Estructura del proyecto

```
frontend/                   React + Vite PWA
  src/
    pages/                  CitizenReport, CitizenTracking, OperatorDashboard, OperatorLogin
    components/             EmergencyMap (Leaflet)
    hooks/                  useOfflineSync, useOnlineStatus, useSession
    lib/                    api, supabaseClient, offlineQueue, types, deviceId

services/
  s1-intake/                Recibe, valida y prioriza reportes nuevos
  s2-dispatch/              Asigna cuadrillas, gestiona la maquina de estados del despacho
  s3-geospatial/            Recalcula clusters DBSCAN por zona via RPC de PostGIS
  s4-notification/          Notifica a organismos externos via webhook
  mock-organismo/           Simula el organismo receptor (solo desarrollo)

libs/emergencias_common/    Paquete Python compartido (schemas Pydantic, cliente Supabase, eventos)

supabase/
  migrations/               DDL en orden: extensiones, tablas, RLS, funciones RPC, vistas
  seed/                     Datos iniciales (4 zonas + cuadrillas de ejemplo)

gateway/nginx.conf          Proxy reverso que imita API Gateway en local
docker-compose.yml          Levanta todo el sistema
```

---

## Flujo de un reporte

```
Ciudadano (PWA)                    Backend                              Base de datos
      |                               |                                      |
      |--- POST /reports -----------> S1 Intake                              |
      |                               |  valida campos (Pydantic)            |
      |                               |  calcula prioridad P1-P4             |
      |                               |  asigna zona por coordenadas ------> zone_lookup(lat, lon)
      |                               |  guarda reporte ------------------> INSERT reports
      |                               |  publica evento ------------------> EventBridge
      |                               |                                      |
      |                               S3 Geospatial (webhook)               |
      |                               |  recalcula clusters DBSCAN -------> refresh_zone_clusters()
      |                               |                                      |
      |  Operador (Dashboard)         |                                      |
      |                               |  ve reportes de su zona <---------- SELECT con RLS
      |                               |  asigna cuadrilla                    |
      |--- POST /dispatch/assign ---> S2 Dispatch                           |
      |                               |  crea asignacion ------------------> INSERT dispatch_assignments
      |                               |  actualiza reporte a "despachado" -> UPDATE reports
      |                               |  publica evento ------------------> EventBridge
      |                               |                                      |
      |                               S4 Notification                        |
      |                               |  envia webhook al organismo -------> mock-organismo
      |                               |                                      |
      |  Ciudadano consulta estado    |                                      |
      |--- GET /reports/:id --------> S1 Intake <--------------------------- SELECT reports
```

---

## Maquinas de estado

**Reporte:**
```
recibido --> despachado --> en_proceso --> resuelto
    \                                       
     \--> descartado (desde cualquier estado)
```

**Asignacion de cuadrilla:**
```
asignado --> en_ruta --> en_sitio --> completado
    \          \           \
     \          \           \--> cancelado
      \          \--> cancelado
       \--> cancelado
```

Las transiciones invalidas se rechazan con HTTP 409 Conflict. La logica esta en `services/s2-dispatch/app/transitions.py`.

---

## Priorizacion automatica

S1 asigna prioridad segun el tipo de emergencia y palabras clave en la descripcion:

| Tipo | Prioridad base |
|---|---|
| Rescate | P1 Critico |
| Medico | P2 Urgente |
| Estructural | P3 Moderado |
| Preventivo | P4 Preventivo |

Si la descripcion contiene palabras como "atrapado", "colapso", "no respira", "inconsciente" o "sangrado", la prioridad sube un nivel (P3 pasa a P2, P2 pasa a P1).

---

## Seguridad

- **Secretos fuera del repositorio**: las credenciales de Supabase se inyectan via variables de entorno. En AWS se recuperan desde Secrets Manager / Parameter Store en tiempo de inicializacion, nunca desde archivos en el repo.
- **RLS por zona**: cada operador autenticado solo accede a datos de su zona. Las politicas estan en `supabase/migrations/0003_rls_policies.sql`.
- **Ciudadanos anonimos**: nunca interactuan con Supabase directamente. Todo pasa por el API Gateway hacia S1, que usa `service_role` key (bypasea RLS por diseno).
- **Sin conexion directa a Postgres**: todos los microservicios acceden via PostgREST/RPC (`supabase-py`), lo que evita agotar el pool de conexiones bajo carga concurrente en Lambda.
- **Idempotencia**: el `idempotency_key` (UUID) generado en el cliente previene reportes duplicados cuando la PWA reintenta desde la cola offline.

---

## Como ejecutar en local

### Prerequisitos

- Docker y Docker Compose
- Node.js 18+ (si se ejecuta el frontend fuera de Docker)
- Un proyecto en [supabase.com](https://supabase.com) (el free tier es suficiente)

### 1. Configurar Supabase

1. Crear un proyecto nuevo en Supabase.
2. En el SQL Editor, ejecutar los archivos de `supabase/migrations/` en orden numerico (0001 a 0006) y luego `supabase/seed/seed.sql`.
3. En Project Settings > API, copiar la URL del proyecto, la `anon key` y la `service_role key`.
4. Crear un usuario operador en Authentication > Add user. Luego insertar su fila en la tabla `profiles` con el mismo `id`, un `zone_id` valido y `role = 'operador'`.

### 2. Variables de entorno

Crear dos archivos (no se incluyen en el repositorio):

**`.env`** (raiz, para los microservicios):
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
EVENT_BUS_NAME=emergencias-bus
ORGANISMO_WEBHOOK_URL=http://mock-organismo:8000/webhook
```

**`frontend/.env`** (para el frontend):
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Levantar el sistema

```bash
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Gateway | http://localhost:8080 |
| S1 Intake | http://localhost:8001 |
| S2 Dispatch | http://localhost:8002 |
| S3 Geospatial | http://localhost:8003 |
| S4 Notification | http://localhost:8004 |

### 4. Tests unitarios

```bash
cd services/s1-intake && PYTHONPATH=. python -m pytest tests/ -v
cd services/s2-dispatch && PYTHONPATH=. python -m pytest tests/ -v
```
