-- Datos semilla para desarrollo local: las 4 zonas del proyecto y algunas cuadrillas.
-- Los poligonos son cajas aproximadas alrededor del centro de cada ciudad -- suficiente
-- para el MVP academico, no son limites administrativos reales.

insert into zones (name, department, boundary) values
  ('Quibdo', 'Choco',
    ST_GeogFromText('POLYGON((-76.72 5.55, -76.56 5.55, -76.56 5.75, -76.72 5.75, -76.72 5.55))')),
  ('Pereira', 'Risaralda',
    ST_GeogFromText('POLYGON((-75.78 4.72, -75.62 4.72, -75.62 4.90, -75.78 4.90, -75.78 4.72))')),
  ('Cali', 'Valle del Cauca',
    ST_GeogFromText('POLYGON((-76.62 3.35, -76.45 3.35, -76.45 3.55, -76.62 3.55, -76.62 3.35))')),
  ('Manizales', 'Caldas',
    ST_GeogFromText('POLYGON((-75.60 4.97, -75.44 4.97, -75.44 5.15, -75.60 5.15, -75.60 4.97))'));

-- Cuadrillas de ejemplo (2 por zona: una de rescate, una medica)
insert into crews (zone_id, name, crew_type, status, current_location)
select z.id, v.name, v.crew_type, 'disponible', ST_GeogFromText(v.point)
from zones z
join (values
  ('Quibdo',    'Rescate Choco 1',   'rescate', 'POINT(-76.6413 5.6947)'),
  ('Quibdo',    'Medica Choco 1',    'medico',  'POINT(-76.6500 5.6900)'),
  ('Pereira',   'Rescate Pereira 1', 'rescate', 'POINT(-75.6946 4.8087)'),
  ('Pereira',   'Medica Pereira 1',  'medico',  'POINT(-75.7000 4.8100)'),
  ('Cali',      'Rescate Cali 1',    'rescate', 'POINT(-76.5320 3.4516)'),
  ('Cali',      'Medica Cali 1',     'medico',  'POINT(-76.5400 3.4600)'),
  ('Manizales', 'Rescate Manizales 1','rescate','POINT(-75.5138 5.0703)'),
  ('Manizales', 'Medica Manizales 1', 'medico', 'POINT(-75.5200 5.0750)')
) as v(zone_name, name, crew_type, point) on v.zone_name = z.name;
