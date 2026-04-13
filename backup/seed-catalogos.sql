-- ============================================
-- SEED: Tablas de catálogos estáticos
-- Ejecutar después de crear el schema:
--   psql cobranza < backup/schema-postgres.sql
--   psql cobranza < backup/seed-catalogos.sql
-- ============================================

BEGIN;

-- ----------------------------------------
-- Paises (2 registros)
-- ----------------------------------------
INSERT INTO "Paises" ("ID", "NombrePais") OVERRIDING SYSTEM VALUE VALUES
  (1, 'Mexico'),
  (2, 'Estados Unidos');

SELECT setval(pg_get_serial_sequence('"Paises"', 'ID'), (SELECT MAX("ID") FROM "Paises"));

-- ----------------------------------------
-- Estados (82 registros: 32 México + 50 USA)
-- ----------------------------------------
INSERT INTO "Estados" ("ID", "ClaveEstado", "NombreEstado", "PaisID") OVERRIDING SYSTEM VALUE VALUES
  (1, 'AGS', 'Aguascalientes', 1),
  (2, 'BC', 'Baja California', 1),
  (3, 'BCS', 'Baja California Sur', 1),
  (4, 'CAM', 'Campeche', 1),
  (5, 'CHIS', 'Chiapas', 1),
  (6, 'CHIH', 'Chihuahua', 1),
  (7, 'CDMX', 'Ciudad de México', 1),
  (8, 'COAH', 'Coahuila', 1),
  (9, 'COL', 'Colima', 1),
  (10, 'DGO', 'Durango', 1),
  (11, 'GTO', 'Guanajuato', 1),
  (12, 'GRO', 'Guerrero', 1),
  (13, 'HGO', 'Hidalgo', 1),
  (14, 'JAL', 'Jalisco', 1),
  (15, 'MEX', 'Estado de México', 1),
  (16, 'MICH', 'Michoacán', 1),
  (17, 'MOR', 'Morelos', 1),
  (18, 'NAY', 'Nayarit', 1),
  (19, 'NL', 'Nuevo León', 1),
  (20, 'OAX', 'Oaxaca', 1),
  (21, 'PUE', 'Puebla', 1),
  (22, 'QRO', 'Querétaro', 1),
  (23, 'QROO', 'Quintana Roo', 1),
  (24, 'SLP', 'San Luis Potosí', 1),
  (25, 'SIN', 'Sinaloa', 1),
  (26, 'SON', 'Sonora', 1),
  (27, 'TAB', 'Tabasco', 1),
  (28, 'TAMPS', 'Tamaulipas', 1),
  (29, 'TLAX', 'Tlaxcala', 1),
  (30, 'VER', 'Veracruz', 1),
  (31, 'YUC', 'Yucatán', 1),
  (32, 'ZAC', 'Zacatecas', 1),
  (33, 'AL', 'Alabama', 2),
  (34, 'AK', 'Alaska', 2),
  (35, 'AZ', 'Arizona', 2),
  (36, 'AR', 'Arkansas', 2),
  (37, 'CA', 'California', 2),
  (38, 'CO', 'Colorado', 2),
  (39, 'CT', 'Connecticut', 2),
  (40, 'DE', 'Delaware', 2),
  (41, 'FL', 'Florida', 2),
  (42, 'GA', 'Georgia', 2),
  (43, 'HI', 'Hawái', 2),
  (44, 'ID', 'Idaho', 2),
  (45, 'IL', 'Illinois', 2),
  (46, 'IN', 'Indiana', 2),
  (47, 'IA', 'Iowa', 2),
  (48, 'KS', 'Kansas', 2),
  (49, 'KY', 'Kentucky', 2),
  (50, 'LA', 'Louisiana', 2),
  (51, 'ME', 'Maine', 2),
  (52, 'MD', 'Maryland', 2),
  (53, 'MA', 'Massachusetts', 2),
  (54, 'MI', 'Michigan', 2),
  (55, 'MN', 'Minnesota', 2),
  (56, 'MS', 'Mississippi', 2),
  (57, 'MO', 'Missouri', 2),
  (58, 'MT', 'Montana', 2),
  (59, 'NE', 'Nebraska', 2),
  (60, 'NV', 'Nevada', 2),
  (61, 'NH', 'New Hampshire', 2),
  (62, 'NJ', 'New Jersey', 2),
  (63, 'NM', 'New Mexico', 2),
  (64, 'NY', 'New York', 2),
  (65, 'NC', 'North Carolina', 2),
  (66, 'ND', 'North Dakota', 2),
  (67, 'OH', 'Ohio', 2),
  (68, 'OK', 'Oklahoma', 2),
  (69, 'OR', 'Oregon', 2),
  (70, 'PA', 'Pennsylvania', 2),
  (71, 'RI', 'Rhode Island', 2),
  (72, 'SC', 'South Carolina', 2),
  (73, 'SD', 'South Dakota', 2),
  (74, 'TN', 'Tennessee', 2),
  (75, 'TX', 'Texas', 2),
  (76, 'UT', 'Utah', 2),
  (77, 'VT', 'Vermont', 2),
  (78, 'VA', 'Virginia', 2),
  (79, 'WA', 'Washington', 2),
  (80, 'WV', 'West Virginia', 2),
  (81, 'WI', 'Wisconsin', 2),
  (82, 'WY', 'Wyoming', 2);

SELECT setval(pg_get_serial_sequence('"Estados"', 'ID'), (SELECT MAX("ID") FROM "Estados"));

-- ----------------------------------------
-- Regimen (19 regímenes fiscales SAT)
-- ----------------------------------------
INSERT INTO "Regimen" ("ID_Regimen", "Codigo", "Descripcion") OVERRIDING SYSTEM VALUE VALUES
  (1, 601, 'General de Ley Personas Morales'),
  (2, 603, 'Personas Morales con Fines no Lucrativos'),
  (3, 605, 'Sueldos y Salarios e Ingresos Asimilados a Salarios'),
  (4, 606, 'Arrendamiento'),
  (5, 607, 'Régimen de Enajenación o Adquisición de Bienes'),
  (6, 608, 'Demás ingresos'),
  (7, 610, 'Residentes en el Extranjero sin Establecimiento Permanente en México'),
  (8, 611, 'Ingresos por Dividendos (socios y accionistas)'),
  (9, 612, 'Personas Físicas con Actividades Empresariales y Profesionales'),
  (10, 614, 'Ingresos por intereses'),
  (11, 615, 'Régimen de los ingresos por obtención de premios'),
  (12, 616, 'Sin obligaciones fiscales'),
  (13, 620, 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos'),
  (14, 621, 'Incorporación Fiscal'),
  (15, 622, 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'),
  (16, 623, 'Opcional para Grupos de Sociedades'),
  (17, 624, 'Coordinados'),
  (18, 625, 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'),
  (19, 626, 'Régimen Simplificado de Confianza');

SELECT setval(pg_get_serial_sequence('"Regimen"', 'ID_Regimen'), (SELECT MAX("ID_Regimen") FROM "Regimen"));

-- ----------------------------------------
-- estados_factura (6 estados)
-- ----------------------------------------
INSERT INTO "estados_factura" ("id", "codigo") OVERRIDING SYSTEM VALUE VALUES
  (1, 'vigente'),
  (2, 'parcial'),
  (3, 'pagada'),
  (4, 'vencida'),
  (5, 'incobrable'),
  (6, 'cancelada');

SELECT setval(pg_get_serial_sequence('"estados_factura"', 'id'), (SELECT MAX("id") FROM "estados_factura"));

-- ----------------------------------------
-- Roles (2 roles)
-- ----------------------------------------
INSERT INTO "Roles" ("Id", "Nombre") OVERRIDING SYSTEM VALUE VALUES
  (3, 'Administrador'),
  (4, 'Agente de Cobranza');

SELECT setval(pg_get_serial_sequence('"Roles"', 'Id'), (SELECT MAX("Id") FROM "Roles"));

-- ----------------------------------------
-- prioridades_cobranza (3 prioridades)
-- ----------------------------------------
INSERT INTO "prioridades_cobranza" ("id", "codigo") OVERRIDING SYSTEM VALUE VALUES
  (1, 'alta'),
  (2, 'media'),
  (3, 'baja');

SELECT setval(pg_get_serial_sequence('"prioridades_cobranza"', 'id'), (SELECT MAX("id") FROM "prioridades_cobranza"));

COMMIT;
