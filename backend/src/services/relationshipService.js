/**
 * BUBU - Relationship Service
 * Maneja relaciones entre usuarios para gastos compartidos
 */

import { query, queryOne, execute } from '../db/connection.js';

/**
 * Crea una relación entre dos usuarios (pareja, roommate, etc.)
 * @param {object} data - Datos de la relación
 * @param {string} data.user_phone_1 - Teléfono del usuario que crea la relación
 * @param {string} data.user_phone_2 - Teléfono del usuario con quien compartir
 * @param {number} data.default_split_user1 - Porcentaje del usuario 1 (ej: 65)
 * @param {number} data.default_split_user2 - Porcentaje del usuario 2 (ej: 35)
 * @returns {Promise<object>} Relación creada
 */
export async function createRelationship(data) {
    const {
        user_phone_1,
        user_phone_2,
        default_split_user1 = 50.00,
        default_split_user2 = 50.00
    } = data;

    // Validar que la suma sea 100
    if (default_split_user1 + default_split_user2 !== 100) {
        throw new Error('La división debe sumar 100%. No puedes dividir ' + default_split_user1 + '/' + default_split_user2);
    }

    // Validar que no sea el mismo usuario
    if (user_phone_1 === user_phone_2) {
        throw new Error('No puedes crear una relación contigo mismo');
    }

    // Verificar que no exista ya una relación (en cualquier dirección)
    const existingRelationship = await queryOne(`
        SELECT * FROM relationships
        WHERE (user_phone_1 = $1 AND user_phone_2 = $2)
           OR (user_phone_1 = $2 AND user_phone_2 = $1)
    `, [user_phone_1, user_phone_2]);

    if (existingRelationship) {
        if (existingRelationship.status === 'pending') {
            throw new Error('Ya existe una solicitud pendiente con este usuario');
        }
        if (existingRelationship.status === 'active') {
            throw new Error('Ya tienes una relación activa con este usuario');
        }
        if (existingRelationship.status === 'rejected') {
            // Permitir recrear si fue rechazada, actualizando a pending
            const result = await execute(`
                UPDATE relationships
                SET status = 'pending',
                    default_split_user1 = $1,
                    default_split_user2 = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `, [default_split_user1, default_split_user2, existingRelationship.id]);

            return result.rows[0];
        }
    }

    // Crear nueva relación con status 'pending'
    const result = await execute(`
        INSERT INTO relationships (
            user_phone_1,
            user_phone_2,
            default_split_user1,
            default_split_user2,
            status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
    `, [user_phone_1, user_phone_2, default_split_user1, default_split_user2]);

    console.log(`✅ Relación creada (pending): ${user_phone_1} <-> ${user_phone_2} (${default_split_user1}/${default_split_user2})`);

    return result.rows[0];
}

/**
 * Obtiene la relación activa de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @returns {Promise<object|null>} Relación activa o null
 */
export async function getRelationship(user_phone) {
    const relationship = await queryOne(`
        SELECT * FROM relationships
        WHERE (user_phone_1 = $1 OR user_phone_2 = $1)
          AND status = 'active'
    `, [user_phone]);

    return relationship;
}

/**
 * Obtiene el teléfono de la pareja del usuario
 * @param {string} user_phone - Teléfono del usuario
 * @returns {Promise<string|null>} Teléfono de la pareja o null
 */
export async function getPartnerPhone(user_phone) {
    const relationship = await getRelationship(user_phone);

    if (!relationship) {
        return null;
    }

    // Determinar cuál es la pareja
    const partnerPhone = relationship.user_phone_1 === user_phone
        ? relationship.user_phone_2
        : relationship.user_phone_1;

    return partnerPhone;
}

/**
 * Obtiene los porcentajes de división para un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @returns {Promise<object|null>} {user_split, partner_split, partner_phone} o null
 */
export async function getDefaultSplit(user_phone) {
    const relationship = await getRelationship(user_phone);

    if (!relationship) {
        return null;
    }

    // Determinar cuál es el usuario y cuál la pareja
    const isUser1 = relationship.user_phone_1 === user_phone;

    return {
        user_split: isUser1 ? relationship.default_split_user1 : relationship.default_split_user2,
        partner_split: isUser1 ? relationship.default_split_user2 : relationship.default_split_user1,
        partner_phone: isUser1 ? relationship.user_phone_2 : relationship.user_phone_1,
        relationship_id: relationship.id
    };
}

/**
 * Acepta una solicitud de relación
 * @param {number} relationship_id - ID de la relación
 * @returns {Promise<object>} Relación actualizada
 */
export async function acceptRelationship(relationship_id) {
    const result = await execute(`
        UPDATE relationships
        SET status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending'
        RETURNING *
    `, [relationship_id]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró una solicitud pendiente con ese ID');
    }

    console.log(`✅ Relación aceptada: ID ${relationship_id}`);

    return result.rows[0];
}

/**
 * Acepta relación buscando por teléfono del usuario que acepta
 * @param {string} user_phone - Teléfono del usuario que acepta
 * @param {string} requester_phone - Teléfono de quien envió la solicitud
 * @returns {Promise<object>} Relación actualizada
 */
export async function acceptRelationshipByPhone(user_phone, requester_phone) {
    const result = await execute(`
        UPDATE relationships
        SET status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE ((user_phone_1 = $1 AND user_phone_2 = $2) OR (user_phone_1 = $2 AND user_phone_2 = $1))
          AND status = 'pending'
        RETURNING *
    `, [requester_phone, user_phone]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró una solicitud pendiente entre estos usuarios');
    }

    console.log(`✅ Relación aceptada: ${requester_phone} <-> ${user_phone}`);

    return result.rows[0];
}

/**
 * Rechaza una solicitud de relación
 * @param {number} relationship_id - ID de la relación
 * @returns {Promise<object>} Relación actualizada
 */
export async function rejectRelationship(relationship_id) {
    const result = await execute(`
        UPDATE relationships
        SET status = 'rejected',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending'
        RETURNING *
    `, [relationship_id]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró una solicitud pendiente con ese ID');
    }

    console.log(`❌ Relación rechazada: ID ${relationship_id}`);

    return result.rows[0];
}

/**
 * Rechaza relación buscando por teléfono
 * @param {string} user_phone - Teléfono del usuario que rechaza
 * @param {string} requester_phone - Teléfono de quien envió la solicitud
 * @returns {Promise<object>} Relación actualizada
 */
export async function rejectRelationshipByPhone(user_phone, requester_phone) {
    const result = await execute(`
        UPDATE relationships
        SET status = 'rejected',
            updated_at = CURRENT_TIMESTAMP
        WHERE ((user_phone_1 = $1 AND user_phone_2 = $2) OR (user_phone_1 = $2 AND user_phone_2 = $1))
          AND status = 'pending'
        RETURNING *
    `, [requester_phone, user_phone]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró una solicitud pendiente entre estos usuarios');
    }

    console.log(`❌ Relación rechazada: ${requester_phone} <-> ${user_phone}`);

    return result.rows[0];
}

/**
 * Actualiza la división por defecto de una relación
 * @param {number} relationship_id - ID de la relación
 * @param {number} split_user1 - Nuevo porcentaje del usuario 1
 * @param {number} split_user2 - Nuevo porcentaje del usuario 2
 * @returns {Promise<object>} Relación actualizada
 */
export async function updateDefaultSplit(relationship_id, split_user1, split_user2) {
    // Validar que la suma sea 100
    if (split_user1 + split_user2 !== 100) {
        throw new Error('La división debe sumar 100%');
    }

    const result = await execute(`
        UPDATE relationships
        SET default_split_user1 = $1,
            default_split_user2 = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'active'
        RETURNING *
    `, [split_user1, split_user2, relationship_id]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró una relación activa con ese ID');
    }

    console.log(`✅ División actualizada: ${split_user1}/${split_user2} (ID ${relationship_id})`);

    return result.rows[0];
}

/**
 * Actualiza división buscando por teléfono del usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {number} user_split - Nuevo porcentaje del usuario
 * @param {number} partner_split - Nuevo porcentaje de la pareja
 * @returns {Promise<object>} Relación actualizada
 */
export async function updateDefaultSplitByPhone(user_phone, user_split, partner_split) {
    // Validar que la suma sea 100
    if (user_split + partner_split !== 100) {
        throw new Error('La división debe sumar 100%');
    }

    const relationship = await getRelationship(user_phone);

    if (!relationship) {
        throw new Error('No tienes una relación activa');
    }

    // Determinar si el usuario es user1 o user2
    const isUser1 = relationship.user_phone_1 === user_phone;
    const split1 = isUser1 ? user_split : partner_split;
    const split2 = isUser1 ? partner_split : user_split;

    return await updateDefaultSplit(relationship.id, split1, split2);
}

/**
 * Desactiva una relación (sin eliminarla)
 * @param {number} relationship_id - ID de la relación
 * @returns {Promise<object>} Relación desactivada
 */
export async function deactivateRelationship(relationship_id) {
    const result = await execute(`
        UPDATE relationships
        SET status = 'inactive',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
    `, [relationship_id]);

    if (result.rowCount === 0) {
        throw new Error('No se encontró la relación');
    }

    console.log(`⏸️ Relación desactivada: ID ${relationship_id}`);

    return result.rows[0];
}

/**
 * Obtiene todas las solicitudes pendientes de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @returns {Promise<Array>} Lista de solicitudes pendientes
 */
export async function getPendingRequests(user_phone) {
    const requests = await query(`
        SELECT * FROM relationships
        WHERE user_phone_2 = $1
          AND status = 'pending'
        ORDER BY created_at DESC
    `, [user_phone]);

    return requests;
}

export default {
    createRelationship,
    getRelationship,
    getPartnerPhone,
    getDefaultSplit,
    acceptRelationship,
    acceptRelationshipByPhone,
    rejectRelationship,
    rejectRelationshipByPhone,
    updateDefaultSplit,
    updateDefaultSplitByPhone,
    deactivateRelationship,
    getPendingRequests
};
