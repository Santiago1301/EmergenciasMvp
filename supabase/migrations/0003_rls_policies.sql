-- Ciudadanos son anonimos: nunca hablan con Supabase directo, solo via API Gateway -> S1,
-- que usa la service_role key (bypassea RLS). Estas politicas solo rigen el acceso
-- autenticado de los operadores, y la lectura publica de datos no sensibles para el
-- dashboard en tiempo real (Supabase Realtime usa la anon key).

alter table zones enable row level security;
alter table reports enable row level security;
alter table profiles enable row level security;
alter table crews enable row level security;
alter table dispatch_assignments enable row level security;
alter table clusters enable row level security;
alter table report_status_history enable row level security;
alter table notifications enable row level security;

-- Helper: zona asignada al operador autenticado actual
create or replace function auth_zone_id()
returns uuid
language sql stable
as $$
  select zone_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns text
language sql stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- zones: lectura publica (necesaria para el mapa y el selector de zona)
create policy zones_select_all on zones for select using (true);

-- profiles: cada operador ve su propio perfil; los admin ven todos
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or auth_role() = 'admin');

-- reports: los operadores solo ven/editan reportes de su zona (admin ve todo)
create policy reports_select_zone on reports for select
  using (auth_role() = 'admin' or zone_id = auth_zone_id());

create policy reports_update_zone on reports for update
  using (auth_role() = 'admin' or zone_id = auth_zone_id());

-- crews: visibles y editables solo dentro de la zona del operador
create policy crews_select_zone on crews for select
  using (auth_role() = 'admin' or zone_id = auth_zone_id());

create policy crews_update_zone on crews for update
  using (auth_role() = 'admin' or zone_id = auth_zone_id());

-- dispatch_assignments: visibles si el reporte asociado es de la zona del operador
create policy dispatch_select_zone on dispatch_assignments for select
  using (
    auth_role() = 'admin' or exists (
      select 1 from reports r
      where r.id = dispatch_assignments.report_id
        and r.zone_id = auth_zone_id()
    )
  );

create policy dispatch_insert_zone on dispatch_assignments for insert
  with check (
    auth_role() = 'admin' or exists (
      select 1 from reports r
      where r.id = dispatch_assignments.report_id
        and r.zone_id = auth_zone_id()
    )
  );

-- clusters: lectura publica dentro del dashboard (no contienen datos sensibles del ciudadano)
create policy clusters_select_all on clusters for select using (true);

-- report_status_history y notifications: solo visibles para el operador de la zona
create policy status_history_select_zone on report_status_history for select
  using (
    auth_role() = 'admin' or exists (
      select 1 from reports r
      where r.id = report_status_history.report_id
        and r.zone_id = auth_zone_id()
    )
  );

create policy notifications_select_zone on notifications for select
  using (
    auth_role() = 'admin' or exists (
      select 1 from reports r
      where r.id = notifications.report_id
        and r.zone_id = auth_zone_id()
    )
  );

-- Nota: no se define ninguna policy de INSERT para "reports" a nivel de usuario
-- autenticado ni anonimo -- la unica via de escritura es S1 con la service_role key,
-- que ignora RLS por diseno. Esto es intencional: mantiene "API Gateway como unico
-- punto de entrada" para escrituras de negocio.
