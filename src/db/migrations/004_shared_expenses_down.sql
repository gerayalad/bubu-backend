-- ============================================
-- BUBU - Migration 004: Shared Expenses ROLLBACK
-- Reverts all changes made by 004_shared_expenses_up.sql
-- ============================================

-- IMPORTANTE: Ejecutar estos comandos en orden inverso a la creación
-- para evitar errores de foreign key constraints

-- Paso 1: Eliminar columnas agregadas a transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_shared_transaction;
DROP INDEX IF EXISTS idx_transactions_shared_id;
DROP INDEX IF EXISTS idx_transactions_shared;
ALTER TABLE transactions DROP COLUMN IF EXISTS shared_transaction_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS is_shared;

-- Paso 2: Eliminar tabla shared_transactions y sus índices
DROP INDEX IF EXISTS idx_shared_transactions_relationship;
DROP INDEX IF EXISTS idx_shared_transactions_payer;
DROP INDEX IF EXISTS idx_shared_transactions_user2;
DROP INDEX IF EXISTS idx_shared_transactions_user1;
DROP TABLE IF EXISTS shared_transactions;

-- Paso 3: Eliminar tabla relationships y sus índices
DROP INDEX IF EXISTS idx_relationships_status;
DROP INDEX IF EXISTS idx_relationships_user2;
DROP INDEX IF EXISTS idx_relationships_user1;
DROP TABLE IF EXISTS relationships;

-- ============================================
-- Verificación post-rollback
-- ============================================
-- Después de ejecutar este script, verificar que:
-- 1. Las tablas relationships y shared_transactions ya no existen
-- 2. La tabla transactions no tiene columnas is_shared ni shared_transaction_id
-- 3. Todas las transacciones existentes siguen intactas
-- 4. No hay errores de foreign key constraints

-- Query de verificación (ejecutar manualmente):
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('relationships', 'shared_transactions');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND column_name IN ('is_shared', 'shared_transaction_id');
