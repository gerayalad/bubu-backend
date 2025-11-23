/**
 * Script para REVERTIR Migración 005: Fix Timezones
 * Uso: node backend/src/db/revert-migration-005.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function revertMigration() {
    console.log('⏮️  Iniciando REVERT de Migración 005: Fix Timezones\n');

    const pool = getDatabase();
    const client = await pool.connect();

    try {
        // Leer archivo de migración DOWN
        const migrationPath = path.join(__dirname, 'migrations', '005_fix_timezones_down.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Leyendo migración DOWN desde:', migrationPath);
        console.log('');

        // Mostrar columnas ANTES del revert
        console.log('📊 Estado de columnas ANTES del revert:');
        const beforeResult = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name IN ('created_at', 'updated_at')
            ORDER BY table_name, column_name
        `);
        console.table(beforeResult.rows);

        // Preguntar confirmación
        console.log('⚠️  ATENCIÓN: Esta operación REVERTIRÁ los cambios de timezone.');
        console.log('   TIMESTAMP WITH TIME ZONE → TIMESTAMP');
        console.log('');
        console.log('   Presiona Ctrl+C para cancelar...');
        console.log('   O espera 5 segundos para continuar...');
        console.log('');

        // Esperar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Aplicar revert
        console.log('⚙️  Revirtiendo migración...');
        await client.query(migrationSQL);
        console.log('✅ Migración revertida exitosamente!');
        console.log('');

        // Mostrar columnas DESPUÉS del revert
        console.log('📊 Estado de columnas DESPUÉS del revert:');
        const afterResult = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name IN ('created_at', 'updated_at')
            ORDER BY table_name, column_name
        `);
        console.table(afterResult.rows);

        console.log('✅ ¡Migración 005 revertida exitosamente!');
        console.log('');

    } catch (error) {
        console.error('❌ Error revirtiendo migración:');
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
revertMigration().catch(console.error);
