-- =====================================================
-- Migración 005: Corrección de Timestamps con Timezone
-- =====================================================
-- Fecha: 2025-11-20
-- Descripción: Convierte TIMESTAMP a TIMESTAMP WITH TIME ZONE
--              para almacenar correctamente la zona horaria
--              de Ciudad de México en created_at y updated_at
-- =====================================================

BEGIN;

-- 1. TABLA: users
-- Actualizar created_at y updated_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

ALTER TABLE users
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE
    USING updated_at AT TIME ZONE 'America/Mexico_City';

-- 2. TABLA: categories
-- Actualizar created_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE categories
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 3. TABLA: transactions
-- Actualizar created_at a TIMESTAMP WITH TIME ZONE
-- NOTA: transaction_date se mantiene como DATE (solo fecha, sin hora)
ALTER TABLE transactions
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 4. TABLA: chat_messages
-- Actualizar created_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE chat_messages
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 5. TABLA: receipt_images
-- Actualizar created_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE receipt_images
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 6. TABLA: relationships
-- Actualizar created_at y updated_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE relationships
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

ALTER TABLE relationships
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE
    USING updated_at AT TIME ZONE 'America/Mexico_City';

-- 7. TABLA: shared_transactions
-- Actualizar created_at a TIMESTAMP WITH TIME ZONE
ALTER TABLE shared_transactions
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- =====================================================
-- NOTA IMPORTANTE:
-- =====================================================
-- Después de esta migración, todos los CURRENT_TIMESTAMP
-- almacenarán la zona horaria de México automáticamente
-- siempre y cuando la conexión a PostgreSQL tenga configurado:
-- SET timezone = 'America/Mexico_City'
--
-- Esto ya está configurado en backend/src/db/connection.js
-- mediante el evento pool.on('connect')
-- =====================================================

COMMIT;

-- Verificar que las columnas fueron actualizadas correctamente
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at')
  AND data_type = 'timestamp with time zone'
ORDER BY table_name, column_name;
