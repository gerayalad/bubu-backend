/**
 * BUBU - WhatsApp Controller
 * Controlador para manejar webhooks de WhatsApp Business API
 */

import { sendWhatsAppMessage, markAsRead, extractMessageFromWebhook, verifyWebhook } from '../services/whatsappService.js';
import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory } from '../services/categoryService.js';
import { saveChatMessage } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber } from '../services/contextService.js';
import { getTutorialMessage } from '../services/tutorialService.js';

/**
 * Webhook de verificación de WhatsApp
 * WhatsApp llama a este endpoint para verificar que el webhook es válido
 */
export async function verifyWebhookEndpoint(req, res) {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log('🔐 Verificando webhook de WhatsApp...');
        console.log('Mode:', mode);
        console.log('Token recibido:', token);

        if (verifyWebhook(mode, token)) {
            console.log('✅ Webhook verificado correctamente');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Token de verificación inválido');
            return res.status(403).send('Forbidden');
        }

    } catch (error) {
        console.error('❌ Error en verificación de webhook:', error);
        return res.status(500).send('Error');
    }
}

/**
 * Webhook para recibir mensajes de WhatsApp
 * WhatsApp envía mensajes a este endpoint
 */
export async function receiveWebhook(req, res) {
    try {
        console.log('📩 Webhook recibido de WhatsApp');

        // Extraer mensaje del webhook
        const messageData = extractMessageFromWebhook(req.body);

        if (!messageData) {
            // No es un mensaje de texto o no hay mensaje
            return res.sendStatus(200);
        }

        const { phone, message, messageId } = messageData;
        console.log(`📱 Mensaje de ${phone}: "${message}"`);

        // Marcar mensaje como leído
        await markAsRead(messageId);

        // Procesar mensaje de forma asíncrona (no bloqueamos la respuesta)
        processWhatsAppMessage(phone, message).catch(err => {
            console.error('❌ Error procesando mensaje de WhatsApp:', err);
        });

        // Responder 200 inmediatamente a WhatsApp
        return res.sendStatus(200);

    } catch (error) {
        console.error('❌ Error en webhook de WhatsApp:', error);
        return res.sendStatus(500);
    }
}

/**
 * Procesa un mensaje de WhatsApp (lógica principal)
 * Reutiliza la misma lógica que el webchat
 */
async function processWhatsAppMessage(user_phone, message) {
    try {
        // Crear o obtener usuario (normaliza el número internamente)
        const user = getOrCreateUser(user_phone);
        const normalizedPhone = user.phone; // Usar el teléfono normalizado de la BD

        // Parsear intent con OpenAI
        const intent = await parseIntent(message, normalizedPhone);

        // Guardar mensaje del usuario
        saveChatMessage({
            user_phone: normalizedPhone, // Usar número normalizado
            role: 'user',
            message,
            intent_json: intent
        });

        // Procesar según la acción detectada
        let result;
        let response;

        switch (intent.action) {
            case 'registrar_transaccion':
                result = await handleRegistrarTransaccion(normalizedPhone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'registrar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: normalizedPhone
                });
                break;

            case 'consultar_estado':
                result = await handleConsultarEstado(normalizedPhone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'consultar_estado',
                    result,
                    userMessage: message,
                    userPhone: normalizedPhone
                });
                break;

            case 'listar_transacciones':
                result = await handleListarTransacciones(normalizedPhone, intent.parameters);
                saveTransactionList(normalizedPhone, result);

                if (result.length === 0) {
                    response = 'No encontré transacciones con esos criterios. ¿Quieres registrar una? Puedes decirme algo como "gasté 500 en comida".';
                } else {
                    const lista = result.map((t, index) =>
                        `${index + 1}. $${t.amount} - ${t.description} (${t.category_name}) - ${t.transaction_date}`
                    ).join('\n');

                    response = `Encontré ${result.length} transacción${result.length > 1 ? 'es' : ''}:\n\n${lista}\n\nPuedes decir "elimina el 1" o "cambia el 2 a $600" para gestionar tus transacciones.`;
                }
                break;

            case 'eliminar_transaccion':
                result = await handleEliminarTransaccion(normalizedPhone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'eliminar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: normalizedPhone
                });
                break;

            case 'editar_transaccion':
                result = await handleEditarTransaccion(normalizedPhone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'editar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: normalizedPhone
                });
                break;

            case 'conversacion_general':
                result = null;
                response = handleConversacionGeneral(intent.parameters);
                break;

            default:
                result = null;
                response = 'No estoy seguro de cómo ayudarte con eso. ¿Podrías ser más específico?';
        }

        // Guardar respuesta del asistente
        saveChatMessage({
            user_phone: normalizedPhone, // Usar número normalizado
            role: 'assistant',
            message: response,
            intent_json: null
        });

        // Enviar respuesta por WhatsApp (usar número original con código de país)
        await sendWhatsAppMessage(user_phone, response);

        console.log(`✅ Respuesta enviada a ${user_phone}`);

        // Si es usuario nuevo y fue un saludo, enviar tutorial de bienvenida
        if (user.isNewUser && intent.action === 'conversacion_general') {
            const tutorialMessage = getTutorialMessage();
            await sendWhatsAppMessage(user_phone, tutorialMessage);
            console.log(`📚 Tutorial enviado a nuevo usuario: ${normalizedPhone}`);
        }

    } catch (error) {
        console.error('❌ Error procesando mensaje de WhatsApp:', error);

        // Enviar mensaje de error al usuario
        const errorMessage = 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?';
        await sendWhatsAppMessage(user_phone, errorMessage);
    }
}

// ==========================================
// Handlers (copiados de chatController.js)
// ==========================================

async function handleRegistrarTransaccion(user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;
    const type = tipo === 'gasto' ? 'expense' : 'income';

    let category = getCategoryByName(categoria);
    if (!category) {
        category = suggestCategory(descripcion, type);
    }
    if (!category) {
        throw new Error(`No encontré la categoría "${categoria}"`);
    }

    let transactionDate = fecha;
    if (!transactionDate) {
        transactionDate = new Date().toISOString().split('T')[0];
    }

    const transaction = createTransaction({
        user_phone,
        category_id: category.id,
        type,
        amount: monto,
        description: descripcion,
        transaction_date: transactionDate
    });

    return transaction;
}

async function handleConsultarEstado(user_phone, params) {
    const { periodo, fecha_inicio, fecha_fin, filtro_categoria, filtro_tipo } = params;

    let startDate, endDate;
    const now = new Date();

    switch (periodo) {
        case 'mes_actual':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;

        case 'mes_pasado':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;

        case 'semana_actual':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            endDate = new Date(now);
            endDate.setDate(now.getDate() + (6 - dayOfWeek));
            break;

        case 'hoy':
            startDate = new Date(now);
            endDate = new Date(now);
            break;

        case 'personalizado':
            startDate = new Date(fecha_inicio);
            endDate = new Date(fecha_fin);
            break;

        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const summary = getFinancialSummary(user_phone, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    });

    summary.periodo = periodo;

    if (filtro_categoria) {
        summary.byCategory = summary.byCategory.filter(c => c.category === filtro_categoria);
    }

    if (filtro_tipo) {
        const type = filtro_tipo === 'gasto' ? 'expense' : 'income';
        summary.byCategory = summary.byCategory.filter(c => c.type === type);
    }

    return summary;
}

async function handleListarTransacciones(user_phone, params) {
    const { categoria, limite = 20, tipo = 'todos', periodo = 'todos', fecha_inicio, fecha_fin } = params;

    const filters = {
        limit: limite
    };

    if (tipo !== 'todos') {
        filters.type = tipo === 'gasto' ? 'expense' : 'income';
    }

    if (categoria) {
        const category = getCategoryByName(categoria);
        if (category) {
            filters.category_id = category.id;
        }
    }

    if (periodo && periodo !== 'todos') {
        let startDate, endDate;
        const now = new Date();

        switch (periodo) {
            case 'mes_actual':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;

            case 'mes_pasado':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;

            case 'semana_actual':
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - dayOfWeek);
                endDate = new Date(now);
                endDate.setDate(now.getDate() + (6 - dayOfWeek));
                break;

            case 'hoy':
                startDate = new Date(now);
                endDate = new Date(now);
                break;

            case 'personalizado':
                startDate = new Date(fecha_inicio);
                endDate = new Date(fecha_fin);
                break;
        }

        if (startDate && endDate) {
            filters.startDate = startDate.toISOString().split('T')[0];
            filters.endDate = endDate.toISOString().split('T')[0];
        }
    }

    return getUserTransactions(user_phone, filters);
}

async function handleEliminarTransaccion(user_phone, params) {
    const { numero } = params;
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    deleteTransaction(transaction.id, user_phone);

    return {
        deleted: transaction,
        numero: numero
    };
}

async function handleEditarTransaccion(user_phone, params) {
    const { numero, nuevo_monto } = params;
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    const oldAmount = transaction.amount;
    const updated = updateTransaction(transaction.id, user_phone, {
        amount: nuevo_monto
    });

    return {
        transaction: updated,
        numero: numero,
        oldAmount: oldAmount,
        newAmount: nuevo_monto
    };
}

function handleConversacionGeneral(params) {
    const { tipo_mensaje } = params;

    switch (tipo_mensaje) {
        case 'saludo':
            return '¡Hola! Soy BUBU, tu asistente de finanzas personales. Puedo ayudarte a registrar tus gastos e ingresos, y consultar tu estado financiero. ¿Qué necesitas?';

        case 'despedida':
            return '¡Hasta luego! Recuerda mantener tus finanzas al día.';

        case 'agradecimiento':
            return '¡De nada! Estoy aquí para ayudarte con tus finanzas.';

        default:
            return '¿En qué puedo ayudarte hoy?';
    }
}

export default {
    verifyWebhookEndpoint,
    receiveWebhook
};
