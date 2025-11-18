/**
 * BUBU - WhatsApp Service
 * Servicio para enviar y recibir mensajes de WhatsApp Business API
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Envía un mensaje de texto por WhatsApp
 * @param {string} to - Número de teléfono del destinatario (sin +)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<object>} Respuesta de la API
 */
export async function sendWhatsAppMessage(to, message) {
    try {
        const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: message
            }
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Mensaje enviado a WhatsApp:', to);
        return response.data;

    } catch (error) {
        console.error('❌ Error enviando mensaje de WhatsApp:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Marca un mensaje como leído
 * @param {string} messageId - ID del mensaje a marcar como leído
 */
export async function markAsRead(messageId) {
    try {
        const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Mensaje marcado como leído:', messageId);

    } catch (error) {
        console.error('❌ Error marcando mensaje como leído:', error.response?.data || error.message);
    }
}

/**
 * Extrae el mensaje de texto del webhook de WhatsApp
 * @param {object} webhookBody - Body del webhook de WhatsApp
 * @returns {object|null} {phone, message, messageId} o null si no es un mensaje de texto
 */
export function extractMessageFromWebhook(webhookBody) {
    try {
        const entry = webhookBody.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Verificar que sea un mensaje
        if (!value?.messages || value.messages.length === 0) {
            return null;
        }

        const message = value.messages[0];

        // Solo procesar mensajes de texto
        if (message.type !== 'text') {
            console.log('⚠️ Mensaje no es de texto, tipo:', message.type);
            return null;
        }

        const phone = message.from; // Número del remitente
        const text = message.text.body;
        const messageId = message.id;

        return {
            phone,
            message: text,
            messageId
        };

    } catch (error) {
        console.error('❌ Error extrayendo mensaje del webhook:', error);
        return null;
    }
}

/**
 * Valida que el webhook venga de WhatsApp
 * @param {string} mode - Modo del webhook
 * @param {string} token - Token de verificación
 * @returns {boolean} true si es válido
 */
export function verifyWebhook(mode, token) {
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
    return mode === 'subscribe' && token === VERIFY_TOKEN;
}

export default {
    sendWhatsAppMessage,
    markAsRead,
    extractMessageFromWebhook,
    verifyWebhook
};
