/**
 * BUBU - WhatsApp Controller
 * Controlador para manejar webhooks de WhatsApp Business API
 */

import { sendWhatsAppMessage, sendInteractiveList, sendInteractiveButtons, markAsRead, extractMessageFromWebhook, verifyWebhook } from '../services/whatsappService.js';
import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory, getAllCategories } from '../services/categoryService.js';
import { saveChatMessage } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber, savePendingTransaction, getPendingTransaction, clearPendingTransaction, saveLastTransaction, getLastTransaction, savePendingAudio, getPendingAudio, clearPendingAudio } from '../services/contextService.js';
import { getTodayMexico, toMexicoDateString } from '../utils/dateUtils.js';
import { transcribeAudio, isSupportedAudioFormat } from '../services/audioTranscriptionService.js';
import {
    saveTransactionContext,
    getTransactionById,
    saveEditingContext,
    getEditingContext,
    saveDeletionContext,
    getDeletionContext,
    clearContext
} from '../utils/contextManager.js';
import { getTutorialMessage } from '../services/tutorialService.js';
import { downloadWhatsAppMedia } from '../services/whatsappMediaService.js';
import { extractReceiptData, validateReceiptData } from '../services/ocrService.js';
import { saveReceiptImage } from '../services/receiptService.js';
import { createRelationship, getRelationship, updateDefaultSplitByPhone, acceptRelationshipByPhone, rejectRelationshipByPhone } from '../services/relationshipService.js';
import { createSharedTransaction, getSharedTransactions } from '../services/sharedTransactionService.js';
import { calculateBalance, getSharedTransactionsForBalance } from '../services/balanceService.js';
import { notifyRelationshipRequest, notifyRelationshipAccepted, notifyRelationshipRejected, notifyPartnerOfSharedExpense, notifyDivisionUpdated } from '../services/notificationService.js';
import {
    handleRegistrarPareja,
    handleConsultarBalance,
    handleListarGastosCompartidos,
    handleActualizarDivisionDefault,
    handleAceptarSolicitudPareja,
    handleRechazarSolicitudPareja
} from './chatController.js';

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
            // No es un mensaje soportado o no hay mensaje
            return res.sendStatus(200);
        }

        const { type, phone, messageId } = messageData;

        // Marcar mensaje como leído
        await markAsRead(messageId);

        // Procesar según tipo de mensaje
        if (type === 'text') {
            const { message } = messageData;
            console.log(`📱 Mensaje de texto de ${phone}: "${message}"`);

            // Procesar mensaje de forma asíncrona (no bloqueamos la respuesta)
            processWhatsAppMessage(phone, message).catch(err => {
                console.error('❌ Error procesando mensaje de WhatsApp:', err);
            });
        } else if (type === 'image') {
            const { mediaId, caption } = messageData;
            console.log(`📸 Imagen recibida de ${phone}, caption: "${caption}"`);

            // Procesar imagen de forma asíncrona
            processImageMessage(phone, mediaId, messageId).catch(err => {
                console.error('❌ Error procesando imagen de WhatsApp:', err);
            });
        } else if (type === 'audio' || type === 'voice') {
            const { mediaId, mimeType } = messageData;
            const audioType = type === 'voice' ? 'nota de voz' : 'audio';
            console.log(`🎙️ ${audioType} recibido de ${phone}, MIME: ${mimeType}`);

            // Procesar audio de forma asíncrona
            processAudioMessage(phone, mediaId, mimeType, messageId).catch(err => {
                console.error('❌ Error procesando audio de WhatsApp:', err);
            });
        } else if (type === 'interactive_reply') {
            const { replyId, replyTitle } = messageData;
            console.log(`🔘 Respuesta interactiva de ${phone}: ${replyId} - ${replyTitle}`);

            // Procesar respuesta interactiva de forma asíncrona
            processInteractiveReply(phone, replyId, replyTitle).catch(err => {
                console.error('❌ Error procesando respuesta interactiva:', err);
            });
        }

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
        const user = await getOrCreateUser(user_phone);
        const normalizedPhone = user.phone; // Usar el teléfono normalizado de la BD

        // DETECCIÓN TEMPRANA: Verificar si hay una transacción pendiente de confirmación
        const pendingTx = getPendingTransaction(normalizedPhone);
        if (pendingTx) {
            const lowerMsg = message.toLowerCase().trim();

            // Detectar confirmación
            const isAffirmative = ['sí', 'si', 'ok', 'confirmo', 'confirma', 'correcto', 'yes'].some(word =>
                lowerMsg === word || lowerMsg.startsWith(word + ' '));

            // Detectar cancelación
            const isCancel = ['no', 'cancelar', 'cancela'].some(word =>
                lowerMsg === word || lowerMsg.startsWith(word + ' '));

            if (isAffirmative) {
                // Crear transacción confirmada
                const transaction = await createTransaction({
                    user_phone: normalizedPhone,
                    category_id: pendingTx.categoria_id,
                    type: pendingTx.type,
                    amount: pendingTx.monto,
                    description: pendingTx.descripcion,
                    transaction_date: pendingTx.fecha
                });

                saveLastTransaction(normalizedPhone, transaction);
                clearPendingTransaction(normalizedPhone);

                const tipoText = pendingTx.type === 'expense' ? 'gasto' : 'ingreso';
                const emoji = pendingTx.type === 'expense' ? '💳' : '💰';
                const response = `✅ ¡Listo! Registré tu ${tipoText} de $${transaction.amount}\n\n${emoji} ${transaction.description}\n📁 ${pendingTx.categoria}`;

                await sendWhatsAppMessage(user_phone, response);
                await saveChatMessage({
                    user_phone: normalizedPhone,
                    role: 'assistant',
                    message: response,
                    intent_json: null
                });

                console.log(`✅ Transacción confirmada: ${transaction.id}`);
                return;
            } else if (isCancel) {
                clearPendingTransaction(normalizedPhone);
                await sendWhatsAppMessage(user_phone, '❌ Transacción cancelada. No se guardó nada.');
                console.log(`❌ Transacción pendiente cancelada para ${normalizedPhone}`);
                return;
            }
        }

        // Verificar si estamos en contexto de edición (esperando un monto)
        const editingTransaction = getEditingContext(normalizedPhone);
        if (editingTransaction) {
            // Intentar parsear el mensaje como número
            const newAmount = parseFloat(message.replace(/[^0-9.]/g, ''));

            if (!isNaN(newAmount) && newAmount > 0) {
                // Actualizar transacción
                const oldAmount = editingTransaction.amount;
                await updateTransaction(editingTransaction.id, normalizedPhone, {
                    amount: newAmount
                });

                // Limpiar contexto
                clearContext(normalizedPhone);

                // Confirmar
                await sendWhatsAppMessage(
                    user_phone,
                    `✅ Monto actualizado:\n\n${editingTransaction.description}\n💵 Antes: $${oldAmount}\n💰 Ahora: $${newAmount}`
                );

                console.log(`✏️ Transacción #${editingTransaction.id} actualizada: $${oldAmount} → $${newAmount}`);
                return;
            } else {
                await sendWhatsAppMessage(user_phone, 'El monto no es válido. Intenta de nuevo o escribe "cancelar".');
                return;
            }
        }

        // Parsear intent con OpenAI
        const intent = await parseIntent(message, normalizedPhone);

        // Guardar mensaje del usuario
        await saveChatMessage({
            user_phone: normalizedPhone, // Usar número normalizado
            role: 'user',
            message,
            intent_json: intent
        });

        // Procesar según la acción detectada
        let result;
        let response;

        switch (intent.action) {
            case 'confirmar_transaccion':
                result = await handleConfirmarTransaccion(normalizedPhone, user_phone, intent.parameters);
                response = result.response;
                break;

            case 'corregir_ultima_transaccion':
                result = await handleCorregirUltimaTransaccion(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'registrar_transaccion':
                result = await handleRegistrarTransaccion(normalizedPhone, intent.parameters);
                // Guardar como última transacción para poder corregirla
                saveLastTransaction(normalizedPhone, result);
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
                    // Guardar contexto de transacciones para mensajes interactivos
                    saveTransactionContext(normalizedPhone, result);

                    // Enviar lista interactiva de WhatsApp
                    await sendTransactionListInteractive(user_phone, normalizedPhone, result);

                    // No establecer response, ya se envió la lista interactiva
                    response = null;
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

            case 'consultar_categorias':
                result = await handleConsultarCategorias(intent.parameters);
                response = result.response;
                break;

            case 'ayuda_uso':
                result = null;
                response = handleAyudaUso(intent.parameters);
                break;

            // ========== GASTOS COMPARTIDOS ==========
            case 'registrar_pareja':
                result = await handleRegistrarPareja(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'consultar_balance':
                result = await handleConsultarBalance(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'listar_gastos_compartidos':
                result = await handleListarGastosCompartidos(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'actualizar_division_default':
                result = await handleActualizarDivisionDefault(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'aceptar_solicitud_pareja':
                result = await handleAceptarSolicitudPareja(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'rechazar_solicitud_pareja':
                result = await handleRechazarSolicitudPareja(normalizedPhone, intent.parameters);
                response = result.response;
                break;

            case 'conversacion_general':
                result = null;
                response = handleConversacionGeneral(intent.parameters);
                break;

            default:
                result = null;
                response = 'No estoy seguro de cómo ayudarte con eso. ¿Podrías ser más específico?';
        }

        // Guardar y enviar respuesta (si existe)
        if (response) {
            await saveChatMessage({
                user_phone: normalizedPhone,
                role: 'assistant',
                message: response,
                intent_json: null
            });

            await sendWhatsAppMessage(user_phone, response);
            console.log(`✅ Respuesta enviada a ${user_phone}`);
        }

        // Si es usuario nuevo y fue un saludo, enviar tutorial de bienvenida
        if (user.isNewUser && intent.action === 'conversacion_general') {
            const tutorialMessage = await getTutorialMessage();
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

/**
 * Prepara una transacción para confirmación con botones interactivos de WhatsApp
 */
async function handleConfirmarTransaccion(normalizedPhone, user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;
    const type = tipo === 'gasto' ? 'expense' : 'income';

    let category = await getCategoryByName(categoria);
    if (!category) {
        category = await suggestCategory(descripcion, type);
    }

    const transactionDate = fecha || getTodayMexico();

    const pendingData = {
        tipo,
        monto,
        descripcion,
        categoria: category.name,
        categoria_id: category.id,
        fecha: transactionDate,
        type
    };

    savePendingTransaction(normalizedPhone, pendingData);

    const [year, month, day] = transactionDate.split('-');
    const displayDate = `${day}/${month}`;
    const emoji = type === 'expense' ? '💳' : '💰';

    const body = `📝 ¿Confirmas esta transacción?

${emoji} *$${monto.toFixed(2)}*
📁 ${category.name}
📝 ${descripcion}
📅 ${displayDate}`;

    // Enviar botones interactivos de WhatsApp
    const buttons = [
        { id: 'confirm_pending', title: '✅ Confirmar' },
        { id: 'cancel_pending', title: '❌ Cancelar' }
    ];

    await sendInteractiveButtons(user_phone, body, buttons);

    return {
        response: null // Ya enviamos los botones directamente
    };
}

/**
 * Corrige un campo de la última transacción registrada
 */
async function handleCorregirUltimaTransaccion(normalizedPhone, params) {
    const { campo, nuevo_valor_categoria, nuevo_valor_monto, nuevo_valor_descripcion, nuevo_valor_fecha } = params;

    const lastTx = getLastTransaction(normalizedPhone);
    if (!lastTx) {
        return {
            response: '🤔 No encuentro ninguna transacción reciente para corregir. Las transacciones solo se pueden corregir dentro de los primeros 10 minutos.'
        };
    }

    const updateData = {};
    let fieldName;
    let newValue;

    switch (campo) {
        case 'categoria':
            const category = await getCategoryByName(nuevo_valor_categoria);
            if (!category) {
                return {
                    response: `❌ No encontré la categoría "${nuevo_valor_categoria}". Escribe "qué categorías existen" para ver todas.`
                };
            }
            updateData.category_id = category.id;
            fieldName = 'la categoría';
            newValue = category.name;
            break;

        case 'monto':
            updateData.amount = nuevo_valor_monto;
            fieldName = 'el monto';
            newValue = `$${nuevo_valor_monto}`;
            break;

        case 'descripcion':
            updateData.description = nuevo_valor_descripcion;
            fieldName = 'la descripción';
            newValue = nuevo_valor_descripcion;
            break;

        case 'fecha':
            updateData.transaction_date = nuevo_valor_fecha;
            fieldName = 'la fecha';
            const [year, month, day] = nuevo_valor_fecha.split('-');
            newValue = `${day}/${month}/${year}`;
            break;

        default:
            return {
                response: '❌ No reconozco ese campo. Puedes corregir: categoría, monto, descripción o fecha.'
            };
    }

    const updatedTransaction = await updateTransaction(lastTx.id, normalizedPhone, updateData);
    saveLastTransaction(normalizedPhone, updatedTransaction);

    return {
        response: `✅ Listo, actualicé ${fieldName} a: *${newValue}*\n\n${updatedTransaction.description} - $${updatedTransaction.amount}`
    };
}

async function handleRegistrarTransaccion(user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;
    const type = tipo === 'gasto' ? 'expense' : 'income';

    let category = await getCategoryByName(categoria);
    if (!category) {
        category = await suggestCategory(descripcion, type);
    }
    if (!category) {
        throw new Error(`No encontré la categoría "${categoria}"`);
    }

    let transactionDate = fecha;
    if (!transactionDate) {
        transactionDate = getTodayMexico();
    }

    const transaction = await createTransaction({
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

    const summary = await getFinancialSummary(user_phone, {
        startDate: toMexicoDateString(startDate),
        endDate: toMexicoDateString(endDate)
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
        const category = await getCategoryByName(categoria);
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
            filters.startDate = toMexicoDateString(startDate);
            filters.endDate = toMexicoDateString(endDate);
        }
    }

    return await getUserTransactions(user_phone, filters);
}

async function handleEliminarTransaccion(user_phone, params) {
    const { numero } = params;
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    await deleteTransaction(transaction.id, user_phone);

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
    const updated = await updateTransaction(transaction.id, user_phone, {
        amount: nuevo_monto
    });

    return {
        transaction: updated,
        numero: numero,
        oldAmount: oldAmount,
        newAmount: nuevo_monto
    };
}

/**
 * Maneja consulta de categorías disponibles
 */
async function handleConsultarCategorias(params) {
    const { tipo_categoria = 'todas' } = params;
    const categories = await getAllCategories();

    let filteredCategories;
    let tipoTexto;

    if (tipo_categoria === 'gasto') {
        filteredCategories = categories.filter(c => c.type === 'expense');
        tipoTexto = 'gastos';
    } else if (tipo_categoria === 'ingreso') {
        filteredCategories = categories.filter(c => c.type === 'income');
        tipoTexto = 'ingresos';
    } else {
        filteredCategories = categories;
        tipoTexto = 'disponibles';
    }

    const expenseCategories = filteredCategories
        .filter(c => c.type === 'expense')
        .map(c => `${c.icon} ${c.name}`)
        .join(', ');

    const incomeCategories = filteredCategories
        .filter(c => c.type === 'income')
        .map(c => `${c.icon} ${c.name}`)
        .join(', ');

    let response = `Estas son las categorías ${tipoTexto}:\n\n`;

    if (tipo_categoria === 'todas' || tipo_categoria === 'gasto') {
        response += `📊 *GASTOS:*\n${expenseCategories}\n\n`;
    }

    if (tipo_categoria === 'todas' || tipo_categoria === 'ingreso') {
        response += `💰 *INGRESOS:*\n${incomeCategories}\n\n`;
    }

    response += 'Puedes usarlas para registrar tus transacciones. Ejemplo: "gasté 500 en comida" 💳';

    return {
        categories: filteredCategories,
        response
    };
}

/**
 * Maneja solicitudes de ayuda e instrucciones de uso
 */
function handleAyudaUso(params) {
    const { tipo_ayuda = 'general' } = params;

    switch (tipo_ayuda) {
        case 'registrar':
            return `Para registrar una transacción, dime el monto, descripción y categoría. Ejemplos:

📊 *GASTOS:*
• "Gasté 350 en tacos"
• "Pagué 1200 de luz"
• "Ayer compré ropa por 800"

💰 *INGRESOS:*
• "Me pagaron 15000 de nómina"
• "Vendí algo por 3500"

Puedo detectar la categoría automáticamente. ¿Qué quieres registrar?`;

        case 'consultar':
            return `Puedo mostrarte tu estado financiero de diferentes periodos:

📈 *CONSULTAS:*
• "¿Cómo voy este mes?"
• "¿Cuánto he gastado?"
• "Gastos del mes pasado"
• "¿Qué gastos tengo en comida?"

También puedes ver listas detalladas:
• "Muestra mis gastos en comida"
• "Ver mis servicios"

¿Qué quieres consultar?`;

        default:
            return `¡Hola! Soy BUBU, tu asistente de finanzas personales 💰

Puedo ayudarte a:

📊 *REGISTRAR:* Gastos e ingresos
• "Gasté 500 en tacos"
• "Me llegó la nómina de 15000"

📈 *CONSULTAR:* Tu estado financiero
• "¿Cómo voy este mes?"
• "Muestra mis gastos en comida"

✏️ *GESTIONAR:* Editar o eliminar
• "Elimina el 1"
• "Cambia el 2 a $600"

💡 Di "qué categorías existen" para ver todas las opciones.

¿En qué te ayudo?`;
    }
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

/**
 * Envía una lista interactiva de transacciones por WhatsApp
 */
async function sendTransactionListInteractive(user_phone, normalizedPhone, transactions) {
    try {
        // WhatsApp limita a 10 items por lista
        const maxItems = 10;
        const transactionsToShow = transactions.slice(0, maxItems);

        // Formatear transacciones como rows de WhatsApp
        const rows = transactionsToShow.map((t) => {
            const emoji = t.type === 'expense' ? '💳' : '💰';

            // WhatsApp requiere max 24 caracteres en el título
            const amountStr = `$${t.amount}`;
            const maxTitleLength = 24;
            const availableForDesc = maxTitleLength - amountStr.length - 3; // -3 for " - "
            const truncatedDesc = t.description.substring(0, Math.max(0, availableForDesc));
            const title = `${amountStr} - ${truncatedDesc}`.substring(0, maxTitleLength);

            // WhatsApp requiere max 72 caracteres en la descripción
            // Formatear fecha como DD/MM
            const date = new Date(t.transaction_date);
            const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            const description = `${emoji} ${t.category_name} - ${formattedDate}`.substring(0, 72);

            return {
                id: `view_${t.id}`,
                title: title,
                description: description
            };
        });

        const sections = [
            {
                title: "Transacciones",
                rows: rows
            }
        ];

        const header = `📋 ${transactions.length} transacción${transactions.length > 1 ? 'es' : ''}`;
        const body = `Encontré ${transactions.length} transacción${transactions.length > 1 ? 'es' : ''}. Selecciona una para ver opciones de editar o eliminar.`;
        const buttonText = "Ver transacciones";

        await sendInteractiveList(user_phone, header, body, buttonText, sections);

        console.log(`📋 Lista interactiva enviada a ${user_phone} con ${rows.length} transacciones`);

    } catch (error) {
        console.error('❌ Error enviando lista interactiva:', error);
        // Fallback a mensaje de texto
        const lista = transactions.map((t, index) =>
            `${index + 1}. $${t.amount} - ${t.description} (${t.category_name})`
        ).join('\n');
        await sendWhatsAppMessage(user_phone, `Encontré ${transactions.length} transacciones:\n\n${lista}`);
    }
}

/**
 * Procesa respuestas interactivas (clicks en botones o listas)
 */
async function processInteractiveReply(user_phone, replyId, replyTitle) {
    try {
        const user = await getOrCreateUser(user_phone);
        const normalizedPhone = user.phone;

        console.log(`🔘 Procesando respuesta interactiva: ${replyId}`);

        // Parsear el replyId (formato: "action_transactionId" o "action_subaction_transactionId")
        // El ID siempre es la última parte después de split('_')
        const parts = replyId.split('_');
        const action = parts[0];
        const transactionIdStr = parts[parts.length - 1];  // Última parte es el ID
        const transactionId = parseInt(transactionIdStr, 10);

        switch (action) {
            case 'confirm':
                // Manejar confirmación de audio transcrito
                if (replyId === 'confirm_audio') {
                    const pendingAudio = getPendingAudio(normalizedPhone);

                    if (!pendingAudio) {
                        await sendWhatsAppMessage(user_phone, '⏰ La confirmación expiró (10 min). Por favor envía el audio de nuevo.');
                        return;
                    }

                    // Limpiar contexto de audio
                    clearPendingAudio(normalizedPhone);

                    // Procesar el texto transcrito como si fuera un mensaje normal
                    console.log(`✅ Audio confirmado, procesando: "${pendingAudio.text}"`);
                    await processWhatsAppMessage(user_phone, pendingAudio.text);
                    return;
                }

                // Manejar confirmación de transacción pendiente
                if (replyId === 'confirm_pending') {
                    const pendingTx = getPendingTransaction(normalizedPhone);

                    if (!pendingTx) {
                        await sendWhatsAppMessage(user_phone, '⏰ La confirmación expiró (5 min). Por favor registra la transacción de nuevo.');
                        return;
                    }

                    // Crear transacción
                    const transaction = await createTransaction({
                        user_phone: normalizedPhone,
                        category_id: pendingTx.categoria_id,
                        type: pendingTx.type,
                        amount: pendingTx.monto,
                        description: pendingTx.descripcion,
                        transaction_date: pendingTx.fecha
                    });

                    saveLastTransaction(normalizedPhone, transaction);
                    clearPendingTransaction(normalizedPhone);

                    const tipoText = pendingTx.type === 'expense' ? 'gasto' : 'ingreso';
                    const emoji = pendingTx.type === 'expense' ? '💳' : '💰';
                    await sendWhatsAppMessage(
                        user_phone,
                        `✅ ¡Listo! Registré tu ${tipoText} de $${transaction.amount}\n\n${emoji} ${transaction.description}\n📁 ${pendingTx.categoria}`
                    );
                    console.log(`✅ Transacción confirmada vía botón: ${transaction.id}`);
                    return;
                }

                // Confirmación de eliminación (ya existente)
                if (replyId.includes('delete')) {
                    await processDeleteConfirmation(user_phone, normalizedPhone, transactionId);
                }
                break;

            case 'cancel':
                // Cancelar audio pendiente
                if (replyId === 'cancel_audio') {
                    clearPendingAudio(normalizedPhone);
                    await sendWhatsAppMessage(user_phone, '❌ Audio cancelado. No se procesó nada.');
                    console.log(`❌ Audio pendiente cancelado vía botón para ${normalizedPhone}`);
                    return;
                }

                // Cancelar transacción pendiente
                if (replyId === 'cancel_pending') {
                    clearPendingTransaction(normalizedPhone);
                    await sendWhatsAppMessage(user_phone, '❌ Transacción cancelada. No se guardó nada.');
                    console.log(`❌ Transacción pendiente cancelada vía botón para ${normalizedPhone}`);
                    return;
                }

                // Cancelar eliminación (ya existente)
                clearContext(normalizedPhone);
                await sendWhatsAppMessage(user_phone, '❌ Operación cancelada.');
                break;

            case 'view':
                // Usuario seleccionó una transacción, mostrar botones de editar/eliminar
                const transaction = getTransactionById(normalizedPhone, transactionId);

                if (!transaction) {
                    await sendWhatsAppMessage(user_phone, 'Lo siento, no encontré esa transacción. El contexto puede haber expirado.');
                    return;
                }

                // Enviar botones de acción
                const buttons = [
                    { id: `edit_${transactionId}`, title: '✏️ Editar' },
                    { id: `delete_${transactionId}`, title: '🗑️ Eliminar' }
                ];

                const emoji = transaction.type === 'expense' ? '💳' : '💰';

                // Formatear fecha como DD/MM
                const date = new Date(transaction.transaction_date);
                const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

                const body = `${emoji} *$${transaction.amount}*\n${transaction.description}\n\n📁 ${transaction.category_name}\n📅 ${formattedDate}\n\n¿Qué quieres hacer?`;

                await sendInteractiveButtons(user_phone, body, buttons);
                break;

            case 'edit':
                // Usuario quiere editar, pedir nuevo monto
                const transactionToEdit = getTransactionById(normalizedPhone, transactionId);

                if (!transactionToEdit) {
                    await sendWhatsAppMessage(user_phone, 'Lo siento, no encontré esa transacción.');
                    return;
                }

                // Guardar contexto de edición
                saveEditingContext(normalizedPhone, transactionToEdit);

                await sendWhatsAppMessage(
                    user_phone,
                    `✏️ Editando: $${transactionToEdit.amount} - ${transactionToEdit.description}\n\n¿Cuál es el nuevo monto?`
                );
                break;

            case 'delete':
                // Usuario quiere eliminar, pedir confirmación
                const transactionToDelete = getTransactionById(normalizedPhone, transactionId);

                if (!transactionToDelete) {
                    await sendWhatsAppMessage(user_phone, 'Lo siento, no encontré esa transacción.');
                    return;
                }

                // Guardar contexto de eliminación
                saveDeletionContext(normalizedPhone, transactionToDelete);

                // Enviar botones de confirmación
                const confirmButtons = [
                    { id: `confirm_delete_${transactionId}`, title: '✅ Sí, eliminar' },
                    { id: `cancel_delete_${transactionId}`, title: '❌ Cancelar' }
                ];

                await sendInteractiveButtons(
                    user_phone,
                    `🗑️ ¿Estás seguro de eliminar esta transacción?\n\n$${transactionToDelete.amount} - ${transactionToDelete.description}`,
                    confirmButtons
                );
                break;

            case 'confirm':
                // Confirmación de eliminación
                if (replyId.includes('delete')) {
                    await processDeleteConfirmation(user_phone, normalizedPhone, transactionId);
                }
                break;

            case 'cancel':
                // Cancelar acción
                clearContext(normalizedPhone);
                await sendWhatsAppMessage(user_phone, '❌ Operación cancelada.');
                break;

            default:
                console.log(`⚠️ Acción no reconocida: ${action}`);
                await sendWhatsAppMessage(user_phone, 'No entendí esa acción. ¿Puedes intentarlo de nuevo?');
        }

    } catch (error) {
        console.error('❌ Error procesando respuesta interactiva:', error);
        await sendWhatsAppMessage(user_phone, 'Lo siento, hubo un error procesando tu selección.');
    }
}

/**
 * Procesa la confirmación de eliminación de una transacción
 */
async function processDeleteConfirmation(user_phone, normalizedPhone, transactionId) {
    try {
        const transaction = getDeletionContext(normalizedPhone);

        if (!transaction || transaction.id !== transactionId) {
            await sendWhatsAppMessage(user_phone, 'Lo siento, el contexto de eliminación expiró. Intenta listar las transacciones de nuevo.');
            return;
        }

        // Eliminar transacción
        await deleteTransaction(transaction.id, normalizedPhone);

        // Limpiar contexto
        clearContext(normalizedPhone);

        // Confirmar
        await sendWhatsAppMessage(
            user_phone,
            `✅ Transacción eliminada:\n\n$${transaction.amount} - ${transaction.description}\n${transaction.category_name}`
        );

        console.log(`🗑️ Transacción #${transaction.id} eliminada por ${normalizedPhone}`);

    } catch (error) {
        console.error('❌ Error eliminando transacción:', error);
        await sendWhatsAppMessage(user_phone, 'Lo siento, hubo un error eliminando la transacción.');
    }
}

/**
 * Procesa un mensaje de imagen (ticket de compra)
 */
async function processImageMessage(user_phone, mediaId, messageId) {
    try {
        console.log(`📸 Procesando imagen de ${user_phone}`);

        // Crear o obtener usuario
        const user = await getOrCreateUser(user_phone);
        const normalizedPhone = user.phone;

        // Enviar mensaje de "procesando"
        await sendWhatsAppMessage(user_phone, '📸 Analizando tu ticket, un momento...');

        // Descargar imagen
        console.log('📥 Descargando imagen de WhatsApp...');
        const media = await downloadWhatsAppMedia(mediaId);

        // Extraer datos con OCR
        console.log('🔍 Extrayendo datos del ticket con OCR...');
        const ocrResult = await extractReceiptData(media.base64, media.mimeType);

        if (!ocrResult.success) {
            console.error('❌ OCR falló:', ocrResult.error);
            await sendWhatsAppMessage(
                user_phone,
                '😕 No pude leer el ticket claramente. ¿Me puedes decir cuánto gastaste?'
            );
            return;
        }

        const { data } = ocrResult;
        const validation = validateReceiptData(data);

        // Si falta el monto, pedirlo
        if (!validation.isValid && validation.missingFields.includes('amount')) {
            await sendWhatsAppMessage(
                user_phone,
                '🤔 Vi el ticket pero no pude leer el monto total. ¿Cuánto fue?'
            );

            // Guardar contexto pendiente
            await saveReceiptImage({
                user_phone: normalizedPhone,
                whatsapp_media_id: mediaId,
                media_url: media.url,
                ocr_result: data,
                status: 'pending_amount'
            });

            return;
        }

        // Si la confianza es baja, pedir confirmación
        if (validation.needsConfirmation) {
            const confirmMessage = `Vi un gasto de $${data.amount} en ${data.category}. ¿Es correcto? (sí/no)`;
            await sendWhatsAppMessage(user_phone, confirmMessage);

            // Guardar en contexto para confirmar
            await saveReceiptImage({
                user_phone: normalizedPhone,
                whatsapp_media_id: mediaId,
                media_url: media.url,
                ocr_result: data,
                status: 'pending_confirmation'
            });

            return;
        }

        // Confianza alta: registrar automáticamente
        console.log(`✅ Datos extraídos con confianza alta (${data.confidence}%)`);

        // Buscar categoría
        const category = await getCategoryByName(data.category);
        if (!category) {
            console.error(`❌ Categoría no encontrada: ${data.category}`);
            await sendWhatsAppMessage(
                user_phone,
                `No encontré la categoría "${data.category}". ¿Me dices cuál debería ser?`
            );
            return;
        }

        // Crear transacción
        const transaction = await createTransaction({
            user_phone: normalizedPhone,
            category_id: category.id,
            type: 'expense',
            amount: data.amount,
            description: data.description || `Compra en ${data.merchant || 'comercio'}`,
            transaction_date: data.date || getTodayMexico()
        });

        // Guardar registro de imagen
        await saveReceiptImage({
            user_phone: normalizedPhone,
            whatsapp_media_id: mediaId,
            media_url: media.url,
            ocr_result: data,
            transaction_id: transaction.id,
            status: 'processed'
        });

        // Confirmar al usuario
        const response = `✅ ¡Listo! Registré un gasto de $${data.amount} en ${data.category} 📸

"${data.description}"`;

        await sendWhatsAppMessage(user_phone, response);

        // Guardar en chat history
        await saveChatMessage({
            user_phone: normalizedPhone,
            role: 'assistant',
            message: response,
            intent_json: null
        });

        console.log(`✅ Transacción creada desde imagen: ${transaction.id}`);

    } catch (error) {
        console.error('❌ Error procesando imagen de WhatsApp:', error);

        await sendWhatsAppMessage(
            user_phone,
            'Lo siento, tuve un problema procesando la imagen. ¿Puedes intentar de nuevo o decirme el gasto manualmente?'
        );
    }
}

/**
 * Procesa un mensaje de audio/voz (transcripción con Whisper)
 */
async function processAudioMessage(user_phone, mediaId, mimeType, messageId) {
    try {
        console.log(`🎙️ Procesando audio de ${user_phone}`);

        // Crear o obtener usuario
        const user = await getOrCreateUser(user_phone);
        const normalizedPhone = user.phone;

        // Enviar mensaje de "procesando"
        await sendWhatsAppMessage(user_phone, '🎙️ Escuchando tu audio, un momento...');

        // Descargar audio
        console.log('📥 Descargando audio de WhatsApp...');
        const media = await downloadWhatsAppMedia(mediaId);

        // Verificar formato soportado
        if (!isSupportedAudioFormat(mimeType)) {
            console.error(`❌ Formato de audio no soportado: ${mimeType}`);
            await sendWhatsAppMessage(
                user_phone,
                '😕 Lo siento, ese formato de audio no es soportado. Intenta con un formato común (mp3, ogg, wav).'
            );
            return;
        }

        // Transcribir con Whisper
        console.log('🔊 Transcribiendo audio con Whisper...');
        const transcriptionResult = await transcribeAudio(media.buffer, mimeType);

        if (!transcriptionResult.success || !transcriptionResult.text) {
            console.error('❌ Transcripción falló:', transcriptionResult.error);
            await sendWhatsAppMessage(
                user_phone,
                '😕 No pude entender el audio. ¿Puedes intentar de nuevo o escribirlo?'
            );
            return;
        }

        const transcribedText = transcriptionResult.text;
        console.log(`✅ Audio transcrito: "${transcribedText}"`);

        // Guardar en contexto pendiente
        savePendingAudio(normalizedPhone, {
            text: transcribedText,
            mediaId,
            messageId
        });

        // Enviar confirmación con botones
        await sendInteractiveButtons(
            user_phone,
            `🎤 Entendí:\n\n*"${transcribedText}"*\n\n¿Quieres que lo procese?`,
            [
                { id: 'confirm_audio', title: '✅ Sí, procesar' },
                { id: 'cancel_audio', title: '❌ Cancelar' }
            ]
        );

        console.log(`✅ Audio transcrito y esperando confirmación de ${normalizedPhone}`);

    } catch (error) {
        console.error('❌ Error procesando audio de WhatsApp:', error);

        await sendWhatsAppMessage(
            user_phone,
            'Lo siento, tuve un problema procesando el audio. ¿Puedes intentar de nuevo o escribirlo manualmente?'
        );
    }
}

export default {
    verifyWebhookEndpoint,
    receiveWebhook
};
