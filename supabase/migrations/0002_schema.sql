-- Esquema de dominio: gestion de emergencias post-sismo
-- Ver docs/architecture (Fase 1) para el diagrama entidad-relacion completo.

create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department text not null,
  boundary geography(polygon, 4326) not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operador', 'admin')) default 'operador',
  full_name text not null,
  phone text,
  zone_id uuid references zones(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_type text not null check (report_type in ('rescate', 'medico', 'estructural', 'preventivo')),
  priority smallint not null check (priority between 1 and 4),
  description text not null,
  location geography(point, 4326) not null,
  zone_id uuid references zones(id),
  status text not null default 'recibido'
    check (status in ('recibido', 'validado', 'despachado', 'en_proceso', 'resuelto', 'descartado')),
  device_id text not null,
  idempotency_key uuid not null unique,
  contact_phone text,
  photo_url text,
  verified boolean not null default false,
  raw_payload jsonb
);

create index idx_reports_location on reports using gist (location);
create index idx_reports_zone_status on reports (zone_id, status);
create index idx_reports_priority on reports (priority);
create index idx_reports_device on reports (device_id);

create table crews (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  name text not null,
  crew_type text not null check (crew_type in ('rescate', 'medico', 'bomberos', 'estructural')),
  status text not null default 'disponible'
    check (status in ('disponible', 'en_ruta', 'ocupado', 'fuera_servicio')),
  current_location geography(point, 4326),
  updated_at timestamptz not null default now()
);

create index idx_crews_location on crews using gist (current_location);
create index idx_crews_zone_status on crews (zone_id, status);

create table dispatch_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  crew_id uuid not null references crews(id),
  operator_id uuid references profiles(id),
  status text not null default 'asignado'
    check (status in ('asignado', 'en_ruta', 'en_sitio', 'completado', 'cancelado')),
  assigned_at timestamptz not null default now(),
  notes text
);

create index idx_dispatch_report on dispatch_assignments (report_id);
create index idx_dispatch_crew on dispatch_assignments (crew_id);

create table clusters (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  computed_at timestamptz not null default now(),
  cluster_label int not null,
  centroid geography(point, 4326) not null,
  report_count int not null,
  priority_score numeric not null default 0,
  bounding_radius_m numeric
);

create index idx_clusters_zone on clusters (zone_id);

create table report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  changed_by uuid references profiles(id),
  status text not null,
  changed_at timestamptz not null default now(),
  note text
);

create index idx_status_history_report on report_status_history (report_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id),
  channel text not null check (channel in ('webhook', 'realtime', 'sms')),
  recipient text,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado', 'fallido')),
  payload jsonb,
  sent_at timestamptz
);

create index idx_notifications_report on notifications (report_id);
