/**
 * BUBU - User Service
 * Gestión de usuarios
 */

import getDatabase from '../db/connection.js';

/**
 * Crea o obtiene un usuario por su número de teléfono
 * Alta automática si no existe
 * @param {string} phone - Número de teléfono (10 dígitos)
 * @returns {object} Usuario creado o encontrado
 */
export function getOrCreateUser(phone) {
    const db = getDatabase();

    // Validar formato de teléfono (10 dígitos)
    if (!/^\d{10}$/.test(phone)) {
        throw new Error('Número de teléfono inválido. Debe tener 10 dígitos.');
    }

    // Buscar usuario existente
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    // Si no existe, crearlo
    if (!user) {
        const stmt = db.prepare('INSERT INTO users (phone) VALUES (?)');
        const result = stmt.run(phone);

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        console.log(`✅ Usuario creado: ${phone}`);
    }

    return user;
}

/**
 * Obtiene un usuario por teléfono
 * @param {string} phone - Número de teléfono
 * @returns {object|null} Usuario o null si no existe
 */
export function getUserByPhone(phone) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

/**
 * Actualiza información de un usuario
 * @param {string} phone - Número de teléfono
 * @param {object} data - Datos a actualizar (name, alias)
 * @returns {object} Usuario actualizado
 */
export function updateUser(phone, data) {
    const db = getDatabase();

    const { name, alias } = data;
    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
    }
    if (alias !== undefined) {
        updates.push('alias = ?');
        values.push(alias);
    }

    if (updates.length === 0) {
        throw new Error('No hay datos para actualizar');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(phone);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE phone = ?`;
    db.prepare(sql).run(...values);

    return getUserByPhone(phone);
}

/**
 * Obtiene todos los usuarios
 * @returns {Array} Lista de usuarios
 */
export function getAllUsers() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

export default {
    getOrCreateUser,
    getUserByPhone,
    updateUser,
    getAllUsers
};
