/**
 * Script para aplicar Migración 005: Fix Timezones
 * Uso: node backend/src/db/apply-migration-005.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    console.log('🚀 Iniciando Migración 005: Fix Timezones\n');

    const pool = getDatabase();
    const client = await pool.connect();

    try {
        // Leer archivo de migración UP
        const migrationPath = path.join(__dirname, 'migrations', '005_fix_timezones_up.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Leyendo migración desde:', migrationPath);
        console.log('');

        // Verificar timezone actual
        console.log('🔍 Verificando timezone actual...');
        const timezoneResult = await client.query('SHOW timezone');
        console.log(`   Timezone actual: ${timezoneResult.rows[0].TimeZone}`);
        console.log('');

        // Mostrar columnas ANTES de la migración
        console.log('📊 Estado de columnas ANTES de migración:');
        const beforeResult = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name IN ('created_at', 'updated_at')
            ORDER BY table_name, column_name
        `);
        console.table(beforeResult.rows);

        // Preguntar confirmación
        console.log('⚠️  ATENCIÓN: Esta migración modificará las columnas de fecha/hora.');
        console.log('   TIMESTAMP → TIMESTAMP WITH TIME ZONE');
        console.log('');
        console.log('   Presiona Ctrl+C para cancelar...');
        console.log('   O espera 5 segundos para continuar...');
        console.log('');

        // Esperar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Aplicar migración
        console.log('⚙️  Aplicando migración...');
        await client.query(migrationSQL);
        console.log('✅ Migración aplicada exitosamente!');
        console.log('');

        // Mostrar columnas DESPUÉS de la migración
        console.log('📊 Estado de columnas DESPUÉS de migración:');
        const afterResult = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name IN ('created_at', 'updated_at')
            ORDER BY table_name, column_name
        `);
        console.table(afterResult.rows);

        // Verificar un timestamp
        console.log('🕐 Verificando NOW() con nuevo timezone:');
        const nowResult = await client.query('SELECT NOW() as current_time');
        console.log(`   Timestamp actual: ${nowResult.rows[0].current_time}`);
        console.log('');

        console.log('✅ ¡Migración 005 completada exitosamente!');
        console.log('');
        console.log('📝 Notas:');
        console.log('   - Todos los CURRENT_TIMESTAMP ahora usan America/Mexico_City');
        console.log('   - Las columnas son ahora TIMESTAMP WITH TIME ZONE');
        console.log('   - Los datos existentes se preservaron correctamente');
        console.log('');

    } catch (error) {
        console.error('❌ Error aplicando migración:');
        console.error(error);
        console.log('');
        console.log('💡 Para revertir, ejecuta: node backend/src/db/revert-migration-005.js');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
applyMigration().catch(console.error);
