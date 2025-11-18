/**
 * BUBU - Conexión a Base de Datos SQLite
 * Maneja la conexión y operaciones con better-sqlite3
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta a la base de datos
const DB_PATH = join(__dirname, '../../database.sqlite');

// Crear conexión a la base de datos
let db = null;

/**
 * Obtiene la instancia de la base de datos
 * @returns {Database} Instancia de la base de datos
 */
export function getDatabase() {
    if (!db) {
        db = new Database(DB_PATH, { verbose: console.log });
        db.pragma('journal_mode = WAL'); // Write-Ahead Logging para mejor performance
        db.pragma('foreign_keys = ON'); // Habilitar foreign keys
    }
    return db;
}

/**
 * Cierra la conexión a la base de datos
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

export default getDatabase;
