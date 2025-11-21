/**
 * BUBU - Notification Service
 * Maneja notificaciones WhatsApp para gastos compartidos
 */

import { sendWhatsAppMessage, sendInteractiveButtons } from './whatsappService.js';

/**
 * Envía notificación de solicitud de pareja
 * @param {string} from_phone - Teléfono de quien envía la solicitud
 * @param {string} to_phone - Teléfono de quien recibe la solicitud
 * @param {object} splitInfo - Información de división {split_user1, split_user2}
 * @returns {Promise<void>}
 */
export async function notifyRelationshipRequest(from_phone, to_phone, splitInfo) {
    try {
        const message = `👫 *Solicitud de Pareja*

${from_phone} quiere compartir gastos contigo.

📊 División propuesta:
• Tú: ${splitInfo.split_user2}%
• ${from_phone}: ${splitInfo.split_user1}%

¿Aceptas? Responde:
✅ "Acepto" para aceptar
❌ "Rechazar" para rechazar`;

        await sendWhatsAppMessage(to_phone, message);
        console.log(`📨 Notificación de solicitud enviada: ${from_phone} → ${to_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de solicitud: ${error.message}`);
        // No lanzamos error para que no bloquee el flujo principal
    }
}

/**
 * Envía notificación cuando la pareja acepta la solicitud
 * @param {string} requester_phone - Teléfono de quien solicitó
 * @param {string} accepter_phone - Teléfono de quien aceptó
 * @returns {Promise<void>}
 */
export async function notifyRelationshipAccepted(requester_phone, accepter_phone) {
    try {
        const message = `🎉 *¡Tu pareja aceptó!*

${accepter_phone} aceptó tu solicitud. Ahora pueden compartir gastos.

💡 Para registrar gastos compartidos, di:
• "Gasté 200 en comida, pagué yo"
• "Mi pareja pagó 150 en uber"
• "Gasté 300 en super, pagué yo 60/40"`;

        await sendWhatsAppMessage(requester_phone, message);
        console.log(`🎉 Notificación de aceptación enviada a: ${requester_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de aceptación: ${error.message}`);
    }
}

/**
 * Envía notificación cuando la pareja rechaza la solicitud
 * @param {string} requester_phone - Teléfono de quien solicitó
 * @param {string} rejecter_phone - Teléfono de quien rechazó
 * @returns {Promise<void>}
 */
export async function notifyRelationshipRejected(requester_phone, rejecter_phone) {
    try {
        const message = `⚠️ *Solicitud rechazada*

${rejecter_phone} rechazó tu solicitud de compartir gastos.

Puedes seguir usando BUBU normalmente para tus gastos personales.`;

        await sendWhatsAppMessage(requester_phone, message);
        console.log(`❌ Notificación de rechazo enviada a: ${requester_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de rechazo: ${error.message}`);
    }
}

/**
 * Envía notificación a la pareja cuando se crea un gasto compartido
 * @param {string} partner_phone - Teléfono de la pareja
 * @param {object} expenseData - Datos del gasto compartido
 * @returns {Promise<void>}
 */
export async function notifyPartnerOfSharedExpense(partner_phone, expenseData) {
    try {
        const {
            payer_phone,
            total_amount,
            description,
            category_name,
            category_icon,
            partner_percentage,
            partner_amount,
            payer_percentage,
            payer_amount
        } = expenseData;

        const paidBy = payer_phone === partner_phone ? 'Pagaste tú' : `Pagó ${payer_phone}`;

        const message = `💳 *Nuevo Gasto Compartido*

${category_icon} $${total_amount} en ${category_name}
📝 ${description}

${paidBy}

📊 División:
• Tu parte: ${partner_percentage}% ($${partner_amount})
• Pareja: ${payer_percentage}% ($${payer_amount})

💡 Consulta el balance diciendo:
"¿Cómo va el balance?"`;

        await sendWhatsAppMessage(partner_phone, message);
        console.log(`💳 Notificación de gasto compartido enviada a: ${partner_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de gasto compartido: ${error.message}`);
    }
}

/**
 * Envía notificación cuando se actualiza la división default
 * @param {string} partner_phone - Teléfono de la pareja
 * @param {string} updater_phone - Teléfono de quien actualizó
 * @param {number} updater_split - Porcentaje de quien actualizó
 * @param {number} partner_split - Porcentaje de la pareja
 * @returns {Promise<void>}
 */
export async function notifyDivisionUpdated(partner_phone, updater_phone, updater_split, partner_split) {
    try {
        const message = `📊 *División actualizada*

${updater_phone} actualizó la división por defecto:

• Tú: ${partner_split}%
• ${updater_phone}: ${updater_split}%

Esta división se aplicará a los próximos gastos compartidos. Siempre puedes especificar una división diferente al registrar cada gasto.`;

        await sendWhatsAppMessage(partner_phone, message);
        console.log(`📊 Notificación de división actualizada enviada a: ${partner_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de división: ${error.message}`);
    }
}

/**
 * Envía notificación cuando se termina la relación
 * @param {string} partner_phone - Teléfono de la pareja
 * @param {string} terminator_phone - Teléfono de quien terminó la relación
 * @returns {Promise<void>}
 */
export async function notifyRelationshipEnded(partner_phone, terminator_phone) {
    try {
        const message = `💔 *Relación terminada*

${terminator_phone} terminó la relación de gastos compartidos.

Ya no compartirán gastos, pero puedes seguir usando BUBU para tus gastos personales.

Los gastos compartidos anteriores siguen guardados en el historial.`;

        await sendWhatsAppMessage(partner_phone, message);
        console.log(`💔 Notificación de relación terminada enviada a: ${partner_phone}`);

    } catch (error) {
        console.error(`❌ Error enviando notificación de relación terminada: ${error.message}`);
    }
}

export default {
    notifyRelationshipRequest,
    notifyRelationshipAccepted,
    notifyRelationshipRejected,
    notifyPartnerOfSharedExpense,
    notifyDivisionUpdated,
    notifyRelationshipEnded
};
