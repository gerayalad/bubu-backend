/**
 * BUBU - Conexión a Base de Datos PostgreSQL
 * Maneja el pool de conexiones con node-postgres (pg)
 */

import pg from 'pg';
const { Pool } = pg;

// Pool de conexiones
let pool = null;

/**
 * Obtiene el pool de conexiones a PostgreSQL
 * @returns {Pool} Pool de conexiones
 */
export function getDatabase() {
    if (!pool) {
        // Configuración del pool
        const config = {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? {
                rejectUnauthorized: false // Railway requiere esto
            } : false,
            max: 20, // Máximo de conexiones en el pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        pool = new Pool(config);

        // Configurar timezone de México para todas las conexiones
        // Esto hace que CURRENT_TIMESTAMP y NOW() usen America/Mexico_City
        pool.on('connect', async (client) => {
            try {
                await client.query("SET timezone = 'America/Mexico_City'");
            } catch (err) {
                console.error('Error configurando timezone:', err);
            }
        });

        // Manejar errores del pool
        pool.on('error', (err) => {
            console.error('Error inesperado en el pool de PostgreSQL:', err);
        });

        console.log('✅ Pool de PostgreSQL creado con timezone America/Mexico_City');
    }

    return pool;
}

/**
 * Ejecuta una query y devuelve todas las filas
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<Array>} Filas resultantes
 */
export async function query(sql, params = []) {
    const pool = getDatabase();
    const result = await pool.query(sql, params);
    return result.rows;
}

/**
 * Ejecuta una query y devuelve una sola fila
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<Object|null>} Primera fila o null
 */
export async function queryOne(sql, params = []) {
    const pool = getDatabase();
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
}

/**
 * Ejecuta una query de modificación (INSERT, UPDATE, DELETE)
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<Object>} Resultado con rowCount y rows
 */
export async function execute(sql, params = []) {
    const pool = getDatabase();
    const result = await pool.query(sql, params);
    return {
        rowCount: result.rowCount,
        rows: result.rows,
        lastId: result.rows[0]?.id // Para INSERTs con RETURNING id
    };
}

/**
 * Cierra el pool de conexiones
 */
export async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('✅ Pool de PostgreSQL cerrado');
    }
}

export default getDatabase;
