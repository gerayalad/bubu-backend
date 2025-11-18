/**
 * BUBU - Inicializador de Base de Datos
 * Ejecuta el schema SQL y prepara la base de datos
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import getDatabase, { queryOne } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Inicializa la base de datos ejecutando el schema SQL
 */
export async function initDatabase() {
    console.log('🗄️  Inicializando base de datos...');

    try {
        const pool = getDatabase();

        // Leer el schema SQL
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');

        // Ejecutar el schema completo (PostgreSQL soporta múltiples statements)
        await pool.query(schema);

        console.log('✅ Base de datos inicializada correctamente');
        console.log('📊 Tablas creadas: users, categories, transactions, chat_messages');

        // Mostrar estadísticas
        const categoryCount = await queryOne('SELECT COUNT(*) as count FROM categories');
        console.log(`📂 Categorías cargadas: ${categoryCount.count}`);

        return true;
    } catch (error) {
        console.error('❌ Error al inicializar base de datos:', error);
        throw error;
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    await initDatabase();
    process.exit(0);
}

export default initDatabase;
