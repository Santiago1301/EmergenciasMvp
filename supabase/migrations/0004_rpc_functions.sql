-- Funciones expuestas via PostgREST RPC (supabase.rpc(...)).
-- Los 4 microservicios acceden a los datos siempre por REST/RPC, nunca con una
-- conexion directa a Postgres -- evita agotar el pool de conexiones cuando Lambda
-- invoca varias veces en paralelo.

-- S3 · Geospatial: recalcula los clusters de una zona con DBSCAN sobre los reportes
-- activos (no resueltos ni descartados) de las ultimas 48 horas.
-- eps_meters: distancia maxima entre puntos de un mismo cluster.
-- min_points: minimo de reportes para formar un cluster (si no, quedan como ruido, label -1).
create or replace function refresh_zone_clusters(
  p_zone_id uuid,
  eps_meters numeric default 300,
  min_points int default 2
)
returns setof clusters
language plpgsql
as $$
begin
  delete from clusters where zone_id = p_zone_id;

  return query
  with clustered as (
    select
      r.id,
      r.location,
      r.priority,
      ST_ClusterDBSCAN(r.location::geometry, eps := eps_meters, minpoints := min_points)
        over () as label
    from reports r
    where r.zone_id = p_zone_id
      and r.status not in ('resuelto', 'descartado')
      and r.created_at > now() - interval '48 hours'
  ),
  grouped as (
    select
      label,
      count(*) as report_count,
      ST_Centroid(ST_Collect(location::geometry))::geography as centroid,
      avg(5 - priority) as priority_score, -- P1 pesa mas que P4
      max(ST_MaxDistance(ST_Collect(location::geometry), ST_Centroid(ST_Collect(location::geometry)))) as bounding_radius_m
    from clustered
    where label is not null -- descarta el ruido (label = -1 lo incluye ST_ClusterDBSCAN como -1, no null; se filtra abajo)
    group by label
  )
  insert into clusters (zone_id, cluster_label, centroid, report_count, priority_score, bounding_radius_m)
  select p_zone_id, label, centroid, report_count, priority_score, bounding_radius_m
  from grouped
  where label >= 0 -- -1 = ruido (reportes aislados), no se agrupan como hotspot
  returning *;
end;
$$;

-- S2 · Dispatch: cuadrilla disponible mas cercana a un punto dentro de una zona,
-- opcionalmente filtrada por tipo de cuadrilla.
create or replace function nearest_available_crew(
  p_zone_id uuid,
  p_location geography,
  p_crew_type text default null
)
returns table (
  id uuid,
  name text,
  crew_type text,
  distance_m numeric
)
language sql stable
as $$
  select
    c.id,
    c.name,
    c.crew_type,
    ST_Distance(c.current_location, p_location) as distance_m
  from crews c
  where c.zone_id = p_zone_id
    and c.status = 'disponible'
    and (p_crew_type is null or c.crew_type = p_crew_type)
  order by c.current_location <-> p_location
  limit 1;
$$;
