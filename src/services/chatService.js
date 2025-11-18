/**
 * BUBU - Chat Service
 * Gestión de mensajes del chat y auditoría
 */

import { query, queryOne, execute } from '../db/connection.js';

/**
 * Guarda un mensaje del chat
 * @param {object} data - Datos del mensaje
 * @returns {object} Mensaje guardado
 */
export async function saveChatMessage(data) {
    const { user_phone, role = 'user', message, intent_json } = data;

    const result = await execute(
        `INSERT INTO chat_messages (user_phone, role, message, intent_json)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
            user_phone,
            role,
            message,
            intent_json ? JSON.stringify(intent_json) : null
        ]
    );

    return await getChatMessageById(result.rows[0].id);
}

/**
 * Obtiene un mensaje por ID
 * @param {number} id - ID del mensaje
 * @returns {object|null} Mensaje o null
 */
export async function getChatMessageById(id) {
    const msg = await queryOne('SELECT * FROM chat_messages WHERE id = $1', [id]);

    if (msg && msg.intent_json) {
        try {
            msg.intent_json = JSON.parse(msg.intent_json);
        } catch (e) {
            msg.intent_json = null;
        }
    }

    return msg;
}

/**
 * Obtiene el historial de mensajes de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {number} limit - Límite de mensajes
 * @returns {Array} Lista de mensajes
 */
export async function getChatHistory(user_phone, limit = 50) {
    const messages = await query(`
        SELECT * FROM chat_messages
        WHERE user_phone = $1
        ORDER BY created_at DESC
        LIMIT $2
    `, [user_phone, limit]);

    // Parsear JSON
    return messages.map(msg => {
        if (msg.intent_json) {
            try {
                msg.intent_json = JSON.parse(msg.intent_json);
            } catch (e) {
                msg.intent_json = null;
            }
        }
        return msg;
    }).reverse(); // Invertir para mostrar del más antiguo al más nuevo
}

export default {
    saveChatMessage,
    getChatMessageById,
    getChatHistory
};
