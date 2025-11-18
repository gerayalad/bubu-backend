/**
 * BUBU - Chat Service
 * Gestión de mensajes del chat y auditoría
 */

import getDatabase from '../db/connection.js';

/**
 * Guarda un mensaje del chat
 * @param {object} data - Datos del mensaje
 * @returns {object} Mensaje guardado
 */
export function saveChatMessage(data) {
    const db = getDatabase();
    const { user_phone, role = 'user', message, intent_json } = data;

    const stmt = db.prepare(`
        INSERT INTO chat_messages (user_phone, role, message, intent_json)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
        user_phone,
        role,
        message,
        intent_json ? JSON.stringify(intent_json) : null
    );

    return getChatMessageById(result.lastInsertRowid);
}

/**
 * Obtiene un mensaje por ID
 * @param {number} id - ID del mensaje
 * @returns {object|null} Mensaje o null
 */
export function getChatMessageById(id) {
    const db = getDatabase();
    const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);

    if (msg && msg.intent_json) {
        msg.intent_json = JSON.parse(msg.intent_json);
    }

    return msg;
}

/**
 * Obtiene el historial de mensajes de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {number} limit - Límite de mensajes
 * @returns {Array} Lista de mensajes
 */
export function getChatHistory(user_phone, limit = 50) {
    const db = getDatabase();
    const messages = db.prepare(`
        SELECT * FROM chat_messages
        WHERE user_phone = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(user_phone, limit);

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
