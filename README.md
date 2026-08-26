# Emergencias MVP

Sistema de gestion de emergencias post-sismo para 4 zonas (Choco, Pereira, Cali,
Manizales): los ciudadanos reportan desde una PWA con soporte offline, y los
operadores despachan cuadrillas desde un dashboard con clustering geoespacial
en tiempo real (PostGIS + DBSCAN).

Este README cubre **solo desarrollo local**. El despliegue a AWS (Docker en
Lambda, API Gateway, Canary deploy) es la fase siguiente del proyecto y vive
fuera de este repo por ahora.

## Estructura

```
frontend/              React + Vite + PWA (ciudadano y operador)
services/
  s1-intake/            Valida, prioriza y guarda un reporte nuevo
  s2-dispatch/           Asigna cuadrillas y gestiona el estado del despacho
  s3-geospatial/          Recalcula clusters DBSCAN por zona
  s4-notification/        Notifica a organismos externos via webhook
  mock-organismo/          Simula el organismo externo (solo para dev/demo)
libs/emergencias_common/ Paquete Python compartido por los 4 microservicios
supabase/
  migrations/             Schema, RLS, funciones RPC (orden numerico)
  seed/                    Datos de ejemplo: las 4 zonas y algunas cuadrillas
gateway/                 nginx que imita el ruteo del API Gateway en local
docker-compose.yml       Levanta los 4 servicios + gateway + mock + frontend
```

## 1. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com) (el free tier alcanza).
2. En el SQL Editor, corre los archivos de `supabase/migrations/` **en orden
   numerico** (0001, 0002, ...), y despues `supabase/seed/seed.sql`.
3. Copia la URL del proyecto, la `anon key` y la `service_role key` (Project
   Settings -> API).
4. Crea al menos un usuario operador: Authentication -> Add user, y luego
   inserta su fila correspondiente en `profiles` (con el mismo `id` del
   usuario, un `zone_id` de la tabla `zones`, y `role = 'operador'`).

## 2. Variables de entorno

```bash
cp .env.example .env                     # usado por los 4 microservicios
cp frontend/.env.example frontend/.env   # usado por el frontend
```

Llena `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` en `.env`, y
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en `frontend/.env`. Ninguno de
los dos se commitea (estan en `.gitignore`).

## 3. Levantar todo con Docker Compose

```bash
docker compose up --build
```

Esto levanta:

| Servicio | URL local |
|---|---|
| Frontend | http://localhost:5173 |
| Gateway (API unica) | http://localhost:8080 |
| S1 Intake | http://localhost:8001 |
| S2 Dispatch | http://localhost:8002 |
| S3 Geospatial | http://localhost:8003 |
| S4 Notification | http://localhost:8004 |
| Mock organismo externo | http://localhost:8005 |

El frontend habla siempre con el gateway (`localhost:8080`), nunca
directo con cada servicio -- asi el codigo no cambia entre local y AWS.

S3 normalmente lo dispara un Database Webhook de Supabase (fuera del alcance
de este repo local). Para probarlo a mano:

```bash
curl -X POST http://localhost:8003/internal/clusters/refresh \
  -H "Content-Type: application/json" \
  -d '{"zone_id": "<uuid-de-una-zona>"}'
```

## 4. Correr sin Docker (mas rapido para iterar en un solo servicio)

```bash
# libreria compartida, una sola vez
pip install -e libs/emergencias_common

# cada servicio, en su propia terminal
cd services/s1-intake && pip install -r requirements.txt && python app/main.py

# frontend
cd frontend && npm install && npm run dev
```

## 5. Tests

```bash
# cada servicio tiene sus propios tests unitarios (logica pura, sin red/DB)
cd services/s1-intake && PYTHONPATH=. python -m pytest tests/ -v
```

## Notas de diseño (por que esta asi)

- **Ciudadanos anonimos**: nunca hablan con Supabase directo, solo con S1 via
  el gateway. `device_id` + `idempotency_key` reemplazan el login para poder
  consultar el estado de un reporte y evitar duplicados si la PWA reintenta
  offline.
- **Operadores autenticados**: Supabase Auth + RLS filtra todo por la zona
  del operador (ver `supabase/migrations/0003_rls_policies.sql`).
- **Todo acceso a datos es via PostgREST/RPC** (`supabase-py`), nunca una
  conexion directa a Postgres -- evita agotar el pool cuando Lambda invoca en
  paralelo.
- **S1/S2 responden sincrono, el resto es asincrono** via el helper
  `publish_event` (EventBridge en AWS; en local solo lo loguea si no hay
  credenciales de AWS).
