-- El frontend (Leaflet) necesita lat/lon planos, no WKB/geography crudo.
-- security_invoker = true hace que estas vistas respeten las mismas RLS
-- policies de las tablas base -- un operador solo ve su zona igual que si
-- consultara "reports"/"clusters" directamente.

create or replace view clusters_view
with (security_invoker = true) as
select
  id,
  zone_id,
  cluster_label,
  report_count,
  priority_score,
  computed_at,
  ST_Y(centroid::geometry) as lat,
  ST_X(centroid::geometry) as lon
from clusters;

create or replace view reports_view
with (security_invoker = true) as
select
  id,
  report_type,
  priority,
  status,
  zone_id,
  device_id,
  created_at,
  description,
  contact_phone,
  ST_Y(location::geometry) as lat,
  ST_X(location::geometry) as lon
from reports;
