-- S1 · Intake: determina a que zona pertenece un reporte segun su ubicacion.
create or replace function find_zone_for_point(p_location geography)
returns uuid
language sql stable
as $$
  select id from zones where ST_Contains(boundary::geometry, p_location::geometry) limit 1;
$$;
