-- =====================================================
-- Migración 005 DOWN: Revertir Corrección de Timestamps
-- =====================================================
-- Fecha: 2025-11-20
-- Descripción: Revierte TIMESTAMP WITH TIME ZONE a TIMESTAMP
--              (sin zona horaria explícita)
-- =====================================================

BEGIN;

-- 1. TABLA: users
-- Revertir created_at y updated_at a TIMESTAMP
ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

ALTER TABLE users
    ALTER COLUMN updated_at TYPE TIMESTAMP
    USING updated_at AT TIME ZONE 'America/Mexico_City';

-- 2. TABLA: categories
-- Revertir created_at a TIMESTAMP
ALTER TABLE categories
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 3. TABLA: transactions
-- Revertir created_at a TIMESTAMP
ALTER TABLE transactions
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 4. TABLA: chat_messages
-- Revertir created_at a TIMESTAMP
ALTER TABLE chat_messages
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 5. TABLA: receipt_images
-- Revertir created_at a TIMESTAMP
ALTER TABLE receipt_images
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

-- 6. TABLA: relationships
-- Revertir created_at y updated_at a TIMESTAMP
ALTER TABLE relationships
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

ALTER TABLE relationships
    ALTER COLUMN updated_at TYPE TIMESTAMP
    USING updated_at AT TIME ZONE 'America/Mexico_City';

-- 7. TABLA: shared_transactions
-- Revertir created_at a TIMESTAMP
ALTER TABLE shared_transactions
    ALTER COLUMN created_at TYPE TIMESTAMP
    USING created_at AT TIME ZONE 'America/Mexico_City';

COMMIT;
