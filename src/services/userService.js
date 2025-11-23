/**
 * BUBU - User Service
 * Gestión de usuarios
 */

import { query, queryOne, execute } from '../db/connection.js';

/**
 * Normaliza un número de teléfono a 10 dígitos
 * Maneja formatos de WhatsApp con código de país
 */
function normalizePhoneNumber(phone) {
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);

    // WhatsApp México: 521 + 10 dígitos
    if (normalized.length === 13 && normalized.startsWith('521')) {
        return normalized.substring(3);
    }
    // Código México: 52 + 10 dígitos
    if (normalized.length === 12 && normalized.startsWith('52')) {
        return normalized.substring(2);
    }
    // Con 1 adelante: 1 + 10 dígitos
    if (normalized.length === 11 && normalized.startsWith('1')) {
        return normalized.substring(1);
    }
    // 10 dígitos directos
    if (normalized.length === 10) {
        return normalized;
    }

    throw new Error(`Número de teléfono inválido: ${phone}`);
}

/**
 * Crea o obtiene un usuario por su número de teléfono
 * Alta automática si no existe
 */
export async function getOrCreateUser(phone) {
    const normalizedPhone = normalizePhoneNumber(phone);

    // Buscar usuario existente
    let user = await queryOne('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
    let isNewUser = false;

    // Si no existe, crearlo
    if (!user) {
        const result = await execute(
            'INSERT INTO users (phone) VALUES ($1) RETURNING *',
            [normalizedPhone]
        );

        user = result.rows[0];
        isNewUser = true;
        console.log(`✅ Usuario creado: ${normalizedPhone}`);
    }

    // Agregar flag para saber si es nuevo
    return {
        ...user,
        isNewUser
    };
}

/**
 * Obtiene un usuario por teléfono
 * @param {string} phone - Número de teléfono
 * @returns {object|null} Usuario o null si no existe
 */
export async function getUserByPhone(phone) {
    return await queryOne('SELECT * FROM users WHERE phone = $1', [phone]);
}

/**
 * Actualiza información de un usuario
 * @param {string} phone - Número de teléfono
 * @param {object} data - Datos a actualizar (name, alias)
 * @returns {object} Usuario actualizado
 */
export async function updateUser(phone, data) {
    const { name, alias } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
    }
    if (alias !== undefined) {
        updates.push(`alias = $${paramCount++}`);
        values.push(alias);
    }

    if (updates.length === 0) {
        throw new Error('No hay datos para actualizar');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(phone);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE phone = $${paramCount}`;
    await execute(sql, values);

    return await getUserByPhone(phone);
}

/**
 * Obtiene todos los usuarios
 * @returns {Array} Lista de usuarios
 */
export async function getAllUsers() {
    return await query('SELECT * FROM users ORDER BY created_at DESC');
}

export default {
    getOrCreateUser,
    getUserByPhone,
    updateUser,
    getAllUsers
};
