-- ============================================================================
-- Script de Verificación de Base de Datos - Gastos Compartidos
-- ============================================================================
-- Versión: 1.0.0
-- Fecha: 2025-11-20
-- Propósito: Verificar que la feature de gastos compartidos esté correctamente
--            configurada en la base de datos
-- ============================================================================

\echo '🔍 Iniciando verificación de base de datos...'
\echo ''

-- ============================================================================
-- 1. VERIFICACIÓN DE TABLAS
-- ============================================================================

\echo '📋 1. Verificando que las tablas existen...'

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationships')
        THEN '✅ Tabla relationships existe'
        ELSE '❌ ERROR: Tabla relationships NO existe - Ejecutar migration 004_shared_expenses_up.sql'
    END as check_relationships;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_transactions')
        THEN '✅ Tabla shared_transactions existe'
        ELSE '❌ ERROR: Tabla shared_transactions NO existe - Ejecutar migration 004_shared_expenses_up.sql'
    END as check_shared_transactions;

\echo ''

-- ============================================================================
-- 2. VERIFICACIÓN DE COLUMNAS EN TRANSACTIONS
-- ============================================================================

\echo '📋 2. Verificando columnas agregadas a tabla transactions...'

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'transactions' AND column_name = 'is_shared'
        )
        THEN '✅ Columna is_shared existe'
        ELSE '❌ ERROR: Columna is_shared NO existe - Ejecutar migration'
    END as check_is_shared;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'transactions' AND column_name = 'shared_transaction_id'
        )
        THEN '✅ Columna shared_transaction_id existe'
        ELSE '❌ ERROR: Columna shared_transaction_id NO existe - Ejecutar migration'
    END as check_shared_transaction_id;

\echo ''

-- ============================================================================
-- 3. VERIFICACIÓN DE ESTRUCTURA DE RELATIONSHIPS
-- ============================================================================

\echo '📋 3. Verificando estructura de tabla relationships...'

SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'relationships'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- 4. VERIFICACIÓN DE CONSTRAINTS
-- ============================================================================

\echo '📋 4. Verificando constraints...'

-- Constraint de división en relationships
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'relationships' AND tc.constraint_type = 'CHECK'
              AND tc.constraint_name LIKE '%split%'
        )
        THEN '✅ Constraint de división (suma 100%) existe en relationships'
        ELSE '⚠️  WARNING: Constraint de división NO encontrado - Puede causar datos inconsistentes'
    END as check_valid_split;

-- Constraint de relación única
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'relationships'
              AND constraint_type = 'UNIQUE'
              AND constraint_name LIKE '%relationship%'
        )
        THEN '✅ Constraint de relación única existe'
        ELSE '⚠️  WARNING: Constraint de relación única NO encontrado'
    END as check_unique_relationship;

-- Constraint de división en shared_transactions
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            WHERE tc.table_name = 'shared_transactions' AND tc.constraint_type = 'CHECK'
              AND tc.constraint_name LIKE '%split%'
        )
        THEN '✅ Constraint de división (suma 100%) existe en shared_transactions'
        ELSE '⚠️  WARNING: Constraint de división NO encontrado en shared_transactions'
    END as check_valid_transaction_split;

\echo ''

-- ============================================================================
-- 5. VERIFICACIÓN DE ÍNDICES
-- ============================================================================

\echo '📋 5. Verificando índices...'

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('relationships', 'shared_transactions')
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- 6. VERIFICACIÓN DE FOREIGN KEYS
-- ============================================================================

\echo '📋 6. Verificando foreign keys...'

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('relationships', 'shared_transactions')
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- 7. ESTADÍSTICAS DE DATOS
-- ============================================================================

\echo '📊 7. Estadísticas de datos actuales...'

\echo '   Relationships:'
SELECT
    status,
    COUNT(*) as count
FROM relationships
GROUP BY status
ORDER BY status;

\echo '   Shared Transactions:'
SELECT COUNT(*) as total_shared_transactions FROM shared_transactions;

\echo '   Transactions Compartidas:'
SELECT COUNT(*) as total_shared_tx_flags FROM transactions WHERE is_shared = true;

\echo ''

-- ============================================================================
-- 8. VERIFICACIÓN DE INTEGRIDAD DE DATOS
-- ============================================================================

\echo '🔍 8. Verificando integridad de datos...'

-- Verificar que no haya divisiones inválidas en relationships
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✅ Todas las divisiones en relationships suman 100%'
        ELSE '❌ ERROR: ' || COUNT(*) || ' relationships con división inválida'
    END as integrity_relationships_split
FROM relationships
WHERE default_split_user1 + default_split_user2 != 100;

-- Verificar que no haya divisiones inválidas en shared_transactions
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✅ Todas las divisiones en shared_transactions suman 100%'
        ELSE '❌ ERROR: ' || COUNT(*) || ' shared_transactions con división inválida'
    END as integrity_shared_tx_split
FROM shared_transactions
WHERE split_percentage_user1 + split_percentage_user2 != 100;

-- Verificar que no haya transacciones huérfanas
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✅ No hay transacciones con is_shared=true sin shared_transaction_id'
        ELSE '⚠️  WARNING: ' || COUNT(*) || ' transacciones compartidas sin shared_transaction_id'
    END as integrity_orphan_shared_flags
FROM transactions
WHERE is_shared = true AND shared_transaction_id IS NULL;

-- Verificar que cada shared_transaction tenga exactamente 2 transacciones
WITH shared_tx_counts AS (
    SELECT
        shared_transaction_id,
        COUNT(*) as tx_count
    FROM transactions
    WHERE is_shared = true AND shared_transaction_id IS NOT NULL
    GROUP BY shared_transaction_id
)
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✅ Todas las shared_transactions tienen exactamente 2 transacciones'
        ELSE '❌ ERROR: ' || COUNT(*) || ' shared_transactions con número incorrecto de transacciones'
    END as integrity_transaction_pairs
FROM shared_tx_counts
WHERE tx_count != 2;

-- Verificar que los teléfonos en relationships existan en users
SELECT
    CASE
        WHEN COUNT(*) = 0
        THEN '✅ Todos los teléfonos en relationships existen en users'
        ELSE '⚠️  WARNING: ' || COUNT(*) || ' teléfonos en relationships sin usuario'
    END as integrity_user_phones
FROM (
    SELECT user_phone_1 as phone FROM relationships
    UNION
    SELECT user_phone_2 as phone FROM relationships
) phones
WHERE phone NOT IN (SELECT phone FROM users);

\echo ''

-- ============================================================================
-- 9. QUERIES DE DIAGNÓSTICO (ÚLTIMOS 10 REGISTROS)
-- ============================================================================

\echo '📋 9. Últimos registros creados...'

\echo '   Últimas 10 relationships:'
SELECT
    id,
    user_phone_1,
    user_phone_2,
    default_split_user1 || '/' || default_split_user2 as split,
    status,
    created_at
FROM relationships
ORDER BY created_at DESC
LIMIT 10;

\echo '   Últimas 10 shared_transactions:'
SELECT
    st.id,
    st.payer_phone,
    st.total_amount,
    st.split_percentage_user1 || '/' || st.split_percentage_user2 as split,
    st.created_at
FROM shared_transactions st
ORDER BY st.created_at DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. RESUMEN FINAL
-- ============================================================================

\echo '============================================================================'
\echo '✅ VERIFICACIÓN COMPLETADA'
\echo '============================================================================'
\echo ''
\echo 'Si viste algún mensaje de ERROR (❌), ejecuta la migration 004_shared_expenses_up.sql'
\echo 'Si viste WARNING (⚠️), revisa los datos y corrige manualmente si es necesario'
\echo ''
\echo 'Para aplicar la migration:'
\echo '  psql -U bubu_user -d bubu_db -f src/db/migrations/004_shared_expenses_up.sql'
\echo ''
\echo 'Para hacer rollback:'
\echo '  psql -U bubu_user -d bubu_db -f src/db/migrations/004_shared_expenses_down.sql'
\echo '============================================================================'
