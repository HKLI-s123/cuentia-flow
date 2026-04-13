-- Script de migración para agregar soporte de planes de organización y límites de clientes
-- Ejecutar en la BD cuando se quiera implementar planes premium

-- 1. Agregar columna de plan a la tabla Organizaciones
-- (Únicamente si se desea implementar diferenciación de planes)
-- Descomenta y ejecuta según sea necesario:

/*
ALTER TABLE Organizaciones
ADD plan_id NVARCHAR(50) NOT NULL DEFAULT 'FREE'
    CHECK (plan_id IN ('FREE', 'PAID'));

-- Crear índice para mejorar queries de identificación de plan
CREATE INDEX IX_Organizaciones_plan_id
    ON Organizaciones(plan_id);

-- Agregar comentarios explicativos
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Plan de la organización: FREE (10 clientes/día, 100 total) o PAID (500 clientes/día, 10000 total)',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'Organizaciones',
    @level2type = N'COLUMN', @level2name = N'plan_id';
*/

-- 2. Para verificar el uso actual de límites, ejecutar:
-- SELECT 
--     o.Id,
--     o.RazonSocial,
--     COALESCE(o.plan_id, 'FREE') as plan,
--     COUNT(c.Id) as total_clientes,
--     SUM(CASE WHEN CAST(c.CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as clientes_hoy
-- FROM Organizaciones o
-- LEFT JOIN Clientes c ON o.Id = c.OrganizacionId
-- GROUP BY o.Id, o.RazonSocial, o.plan_id
-- ORDER BY total_clientes DESC;

-- 3. Límites configurados actualmente:
-- PLAN FREE:
--   - 10 clientes por día
--   - 100 clientes totales
--
-- PLAN PAID:
--   - 500 clientes por día
--   - 10,000 clientes totales
--
-- Todos las organizaciones nuevas inician con plan FALSE por defecto
-- Los límites están definidos en: src/lib/server/validar-limites-clientes.ts
