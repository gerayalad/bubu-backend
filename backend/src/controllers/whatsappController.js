/**
 * BUBU - WhatsApp Controller
 * Controlador para manejar webhooks de WhatsApp Business API
 */

import { sendWhatsAppMessage, sendInteractiveList, sendInteractiveButtons, markAsRead, extractMessageFromWebhook, verifyWebhook } from '../services/whatsappService.js';
import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory, getAllCategories, createCategory, updateCategory, deleteCategory, moveTransactionsBetweenCategories } from '../services/categoryService.js';
import { saveChatMessage } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber, savePendingTransaction, getPendingTransaction, clearPendingTransaction, saveLastTransaction, getLastTransaction, savePendingAudio, getPendingAudio, clearPendingAudio, savePendingReceipt, getPendingReceipt, clearPendingReceipt } from '../services/contextService.js';
import { getTodayMexico, toMexicoDateString } from '../utils/dateUtils.js';
import { selectIcon, selectColor } from '../utils/iconMapper.js';
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
    handleRechazarSolicitudPareja,
    handleRegistrarTransaccion as handleRegistrarTransaccionFromChat
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

                const tipoText = 'gasto';
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
                // Usar handler de chatController que tiene lógica de gastos compartidos
                result = await handleRegistrarTransaccionFromChat(normalizedPhone, intent.parameters);
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

            case 'crear_categoria':
                result = await handleCrearCategoria(intent.parameters);
                response = result.response;
                break;

            case 'editar_categoria':
                result = await handleEditarCategoria(intent.parameters);
                response = result.response;
                break;

            case 'eliminar_categoria':
                result = await handleEliminarCategoria(intent.parameters);
                response = result.response;
                break;

            case 'mover_transacciones_categoria':
                result = await handleMoverTransaccionesCategoria(normalizedPhone, intent.parameters);
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
    const type = 'expense';

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

// ❌ REMOVIDO: handleRegistrarTransaccion duplicado
// Ahora se usa handleRegistrarTransaccionFromChat importado de chatController.js
// que tiene la lógica completa de gastos compartidos con el fix || quien_pago

async function handleConsultarEstado(user_phone, params) {
    const { periodo, fecha_inicio, fecha_fin, filtro_categoria, filtro_tipo } = params;

    let startDate, endDate;
    const now = new Date();

    switch (periodo) {
        case 'mes_actual':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;

        case 'mes_hasta_hoy':
            // Desde el inicio del mes hasta hoy
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now); // Hoy
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
        const type = 'expense';
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
        filters.type = 'expense';
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

            case 'mes_hasta_hoy':
                // Desde el inicio del mes hasta hoy
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now); // Hoy
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
    const { numero, nuevo_monto, nueva_categoria, nueva_descripcion, nueva_fecha } = params;

    // Obtener transacción del contexto
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    // Preparar datos de actualización
    const updateData = {};
    const changes = [];

    if (nuevo_monto !== undefined) {
        updateData.amount = nuevo_monto;
        changes.push({ field: 'monto', old: transaction.amount, new: nuevo_monto });
    }

    if (nueva_categoria) {
        const category = await getCategoryByName(nueva_categoria);
        if (!category) {
            throw new Error(`No encontré la categoría "${nueva_categoria}"`);
        }
        updateData.category_id = category.id;
        changes.push({ field: 'categoria', old: transaction.category_name, new: nueva_categoria });
    }

    if (nueva_descripcion !== undefined) {
        updateData.description = nueva_descripcion;
        changes.push({ field: 'descripcion', old: transaction.description, new: nueva_descripcion });
    }

    if (nueva_fecha) {
        updateData.transaction_date = nueva_fecha;
        changes.push({ field: 'fecha', old: transaction.transaction_date, new: nueva_fecha });
    }

    if (changes.length === 0) {
        throw new Error('No especificaste ningún cambio. ¿Qué quieres modificar?');
    }

    // Actualizar transacción
    const updated = await updateTransaction(transaction.id, user_phone, updateData);

    return {
        transaction: updated,
        numero: numero,
        changes: changes,
        // Mantener compatibilidad con código antiguo
        oldAmount: transaction.amount,
        newAmount: nuevo_monto || transaction.amount
    };
}

/**
 * Maneja consulta de categorías disponibles
 */
async function handleConsultarCategorias(params) {
    const { tipo_categoria = 'todas' } = params;
    const categories = await getAllCategories();

    // Las primeras 9 categorías son predefinidas (solo gastos)
    const predefinedCategoryNames = [
        'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Otros Gastos'
    ];

    let filteredCategories;
    let tipoTexto;

    if (tipo_categoria === 'personalizadas') {
        // Solo categorías personalizadas (las que no están en la lista predefinida)
        filteredCategories = categories.filter(c => !predefinedCategoryNames.includes(c.name));
        tipoTexto = 'personalizadas';
    } else if (tipo_categoria === 'gasto') {
        filteredCategories = categories.filter(c => c.type === 'expense');
        tipoTexto = 'gastos';
    } else {
        // Mostrar todas (solo hay gastos)
        filteredCategories = categories;
        tipoTexto = 'disponibles';
    }

    // Si solo son personalizadas y no hay ninguna
    if (tipo_categoria === 'personalizadas' && filteredCategories.length === 0) {
        return {
            categories: [],
            response: 'Aún no has creado categorías personalizadas. Puedes crear una diciendo: "crea una categoría de gastos llamada Mascotas" 🐶'
        };
    }

    const expenseCategories = filteredCategories
        .map(c => `${c.icon} ${c.name}`)
        .join(', ');

    let response = `Estas son las categorías ${tipoTexto}:\n\n`;

    if (expenseCategories) {
        response += `📊 *GASTOS:*\n${expenseCategories}\n\n`;
    }

    if (tipo_categoria === 'personalizadas') {
        response += `Tienes ${filteredCategories.length} categoría${filteredCategories.length > 1 ? 's' : ''} personalizada${filteredCategories.length > 1 ? 's' : ''}. Puedes crear más diciendo: "crea categoría Gimnasio" 💪`;
    } else {
        response += 'Puedes usarlas para registrar tus transacciones. Ejemplo: "gasté 500 en comida" 💳';
    }

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

📸 *CON FOTO DE TICKET:*
• Envía una foto del ticket
• Detecto automáticamente el monto total (incluyendo propina)
• Identifico el comercio y sugiero la categoría

Puedo detectar la categoría automáticamente. ¿Qué quieres registrar?`;

        case 'consultar':
            return `Puedo mostrarte tu estado financiero de diferentes periodos:

📈 *CONSULTAS:*
• "¿Cómo voy este mes?"
• "¿Cuánto he gastado?"
• "Gastos de hoy"
• "Ver todos los gastos hasta hoy"
• "Gastos del mes pasado"
• "¿Qué gastos tengo en comida?"

También puedes ver listas detalladas:
• "Muestra mis gastos en comida"
• "Ver mis servicios"
• "Lista de gastos de hoy"

¿Qué quieres consultar?`;

        default:
            return `¡Hola! Soy BUBU, tu asistente de finanzas personales 💰

Puedo ayudarte a:

📊 *REGISTRAR:* Gastos
• "Gasté 500 en tacos"
• "Pagué 1200 de luz"
• 📸 Envía foto del ticket (captura el total con propina)

📈 *CONSULTAR:* Tu estado financiero
• "¿Cómo voy este mes?"
• "Gastos de hoy"
• "Ver todos los gastos hasta hoy"
• "Muestra mis gastos en comida"

✏️ *GESTIONAR:* Editar o eliminar
• "Elimina el 1"
• "Cambia el 2 a $600"
• "Cambia la categoría del 1 a Comida"
• "Cambia la descripción del 2 a Netflix"

🏷️ *CATEGORÍAS PERSONALIZADAS:*
• "Crea categoría Mascotas"
• "Ver categorías personalizadas"
• "Qué categorías existen"

💑 *GASTOS COMPARTIDOS:*
• "Registra a mi pareja con teléfono 5512345678"
• "Gasté 200 en comida, pagué yo"
• "¿Cómo va el balance?"

¿En qué te ayudo?`;
    }
}

function handleConversacionGeneral(params) {
    const { tipo_mensaje } = params;

    switch (tipo_mensaje) {
        case 'saludo':
            return '¡Hola! Soy BUBU, tu asistente de finanzas personales. Puedo ayudarte a registrar tus gastos y consultar tu estado financiero. ¿Qué necesitas?';

        case 'despedida':
            return '¡Hasta luego! Recuerda mantener tus finanzas al día.';

        case 'agradecimiento':
            return '¡De nada! Estoy aquí para ayudarte con tus finanzas.';

        default:
            // Respuesta mejorada para preguntas generales
            return `¡Claro! Puedo ayudarte con:

📊 *Registrar* gastos (texto o foto de ticket)
💰 *Consultar* tu estado (hoy, del mes, hasta hoy)
📋 *Ver* listas de transacciones
✏️ *Editar* categoría, monto, descripción o fecha
🗑️ *Eliminar* transacciones
🏷️ *Crear categorías personalizadas*
💑 *Gastos compartidos* con tu pareja

Ejemplos:
• "Gasté 500 en tacos"
• "Gastos de hoy"
• "Ver todos los gastos hasta hoy"
• "Cambia la categoría del 1 a Comida"
• "Crea categoría Mascotas"

Di "ayuda" para más información.

¿Qué quieres hacer?`;
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

                    const tipoText = 'gasto';
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

            case 'receipt':
                // Manejar respuestas de confirmación de receipt (foto de ticket)
                console.log(`📸 Procesando respuesta de receipt: ${replyId}`);

                if (replyId === 'receipt_individual') {
                    await processReceiptAsIndividual(normalizedPhone, user_phone);
                } else if (replyId === 'receipt_shared_yo') {
                    await processReceiptAsShared(normalizedPhone, user_phone, 'yo');
                } else if (replyId === 'receipt_shared_pareja') {
                    await processReceiptAsShared(normalizedPhone, user_phone, 'pareja');
                } else {
                    console.log(`⚠️ Tipo de receipt no reconocido: ${replyId}`);
                    await sendWhatsAppMessage(user_phone, 'No entendí esa opción. Por favor intenta de nuevo.');
                }
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
 * Procesa un receipt (foto de ticket) como gasto INDIVIDUAL
 */
async function processReceiptAsIndividual(normalizedPhone, user_phone) {
    try {
        const pendingReceipt = getPendingReceipt(normalizedPhone);

        if (!pendingReceipt) {
            await sendWhatsAppMessage(user_phone, '⏰ La confirmación expiró (10 min). Por favor envía la foto de nuevo.');
            return;
        }

        console.log(`👤 Procesando receipt como gasto individual: $${pendingReceipt.amount}`);

        // Crear transacción individual
        const transaction = await createTransaction({
            user_phone: normalizedPhone,
            category_id: pendingReceipt.category_id,
            type: 'expense',
            amount: pendingReceipt.amount,
            description: pendingReceipt.description,
            transaction_date: pendingReceipt.date
        });

        // Guardar registro de imagen
        await saveReceiptImage({
            user_phone: normalizedPhone,
            whatsapp_media_id: pendingReceipt.media_id,
            media_url: pendingReceipt.media_url,
            ocr_result: pendingReceipt.ocr_result,
            transaction_id: transaction.id,
            status: 'processed'
        });

        // Limpiar pending receipt
        clearPendingReceipt(normalizedPhone);

        // Confirmar al usuario
        const response = `✅ ¡Listo! Registré un gasto individual de $${transaction.amount} en ${pendingReceipt.category} 📸`;

        await sendWhatsAppMessage(user_phone, response);

        // Guardar en chat history
        await saveChatMessage({
            user_phone: normalizedPhone,
            role: 'assistant',
            message: response,
            intent_json: null
        });

        console.log(`✅ Transacción individual creada desde receipt: ${transaction.id}`);

    } catch (error) {
        console.error('❌ Error procesando receipt como individual:', error);
        await sendWhatsAppMessage(user_phone, 'Lo siento, hubo un error registrando el gasto. Por favor intenta de nuevo.');
    }
}

/**
 * Procesa un receipt (foto de ticket) como gasto COMPARTIDO
 */
async function processReceiptAsShared(normalizedPhone, user_phone, quien_pago) {
    try {
        const pendingReceipt = getPendingReceipt(normalizedPhone);

        if (!pendingReceipt) {
            await sendWhatsAppMessage(user_phone, '⏰ La confirmación expiró (10 min). Por favor envía la foto de nuevo.');
            return;
        }

        console.log(`💑 Procesando receipt como gasto compartido: $${pendingReceipt.amount} | Pagó: ${quien_pago}`);

        // Usar handleRegistrarTransaccionFromChat con parámetros de gasto compartido
        const result = await handleRegistrarTransaccionFromChat(normalizedPhone, {
            tipo: 'gasto',
            monto: pendingReceipt.amount,
            descripcion: pendingReceipt.description,
            categoria: pendingReceipt.category,
            fecha: pendingReceipt.date,
            es_compartido: true,
            quien_pago: quien_pago  // 'yo' o 'pareja'
        });

        // Guardar registro de imagen (asociar con la transacción del usuario actual)
        const userData = result.user1.phone === normalizedPhone ? result.user1 : result.user2;

        await saveReceiptImage({
            user_phone: normalizedPhone,
            whatsapp_media_id: pendingReceipt.media_id,
            media_url: pendingReceipt.media_url,
            ocr_result: pendingReceipt.ocr_result,
            transaction_id: userData.transaction_id,
            status: 'processed'
        });

        // Limpiar pending receipt
        clearPendingReceipt(normalizedPhone);

        // Generar respuesta natural
        const response = await generateNaturalResponse({
            action: 'registrar_transaccion',
            result,
            userMessage: `Gasté ${pendingReceipt.amount} en ${pendingReceipt.description}`,
            userPhone: normalizedPhone
        });

        await sendWhatsAppMessage(user_phone, response);

        // Guardar en chat history
        await saveChatMessage({
            user_phone: normalizedPhone,
            role: 'assistant',
            message: response,
            intent_json: null
        });

        console.log(`✅ Gasto compartido creado desde receipt: shared_id ${result.shared_transaction_id}`);

    } catch (error) {
        console.error('❌ Error procesando receipt como compartido:', error);
        await sendWhatsAppMessage(user_phone, 'Lo siento, hubo un error registrando el gasto compartido. Por favor intenta de nuevo.');
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

        // Confianza alta: verificar si tiene pareja para preguntar si es compartido
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

        // Verificar si el usuario tiene pareja registrada
        const relationship = await getRelationship(normalizedPhone);
        const hasActivePartner = relationship && relationship.status === 'active';

        if (hasActivePartner) {
            // Usuario CON pareja: Guardar pending receipt y preguntar si es compartido
            console.log(`💑 Usuario tiene pareja activa, mostrando opciones de gasto compartido`);

            const pendingReceiptData = {
                amount: data.amount,
                category: data.category,
                category_id: category.id,
                description: data.description || `Compra en ${data.merchant || 'comercio'}`,
                merchant: data.merchant,
                date: data.date || getTodayMexico(),
                confidence: data.confidence,
                media_id: mediaId,
                media_url: media.url,
                ocr_result: data
            };

            savePendingReceipt(normalizedPhone, pendingReceiptData);

            // Enviar botones interactivos
            await sendInteractiveButtons(
                user_phone,
                `📸 Vi un gasto de $${data.amount} en ${data.category}\n🏪 ${data.merchant || 'Comercio'}\n\n¿Es compartido?`,
                [
                    { id: 'receipt_individual', title: '👤 Solo yo' },
                    { id: 'receipt_shared_yo', title: '💑 Pagué yo' },
                    { id: 'receipt_shared_pareja', title: '💑 Pagó pareja' }
                ]
            );

            console.log(`📨 Botones de gasto compartido enviados`);

        } else {
            // Usuario SIN pareja: Crear transacción individual automáticamente (comportamiento original)
            console.log(`👤 Usuario sin pareja, creando gasto individual automáticamente`);

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

"${data.description || data.merchant || ''}"`;

            await sendWhatsAppMessage(user_phone, response);

            // Guardar en chat history
            await saveChatMessage({
                user_phone: normalizedPhone,
                role: 'assistant',
                message: response,
                intent_json: null
            });

            console.log(`✅ Transacción creada desde imagen: ${transaction.id}`);
        }

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

/**
 * Maneja la creación de una categoría personalizada
 */
async function handleCrearCategoria(params) {
    const { nombre, tipo } = params;

    // Convertir tipo a formato de BD (solo expense, no hay income)
    const type = 'expense';

    // Verificar si la categoría ya existe
    const existing = await getCategoryByName(nombre);
    if (existing) {
        return {
            response: `Ya existe una categoría llamada "${nombre}". ¿Quieres usar otro nombre?`
        };
    }

    // Seleccionar icono y color automáticamente
    const icon = selectIcon(nombre, type);
    const color = selectColor(type);

    try {
        // Crear la categoría
        const newCategory = await createCategory({
            name: nombre,
            type: type,
            color: color,
            icon: icon
        });

        const tipoTexto = 'gastos';
        const response = `✅ ¡Listo! Creé la categoría "${nombre}" ${icon} para ${tipoTexto}. Ya puedes usarla en tus transacciones.`;

        return {
            category: newCategory,
            response
        };
    } catch (error) {
        console.error('Error creando categoría:', error);

        // Manejar error de nombre duplicado
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
            return {
                response: `Ya existe una categoría con el nombre "${nombre}". ¿Quieres usar otro nombre?`
            };
        }

        return {
            response: `❌ Error al crear la categoría: ${error.message}`
        };
    }
}

/**
 * Maneja la edición de una categoría personalizada
 */
async function handleEditarCategoria(params) {
    const { nombre_actual, nombre_nuevo, color_nuevo, icono_nuevo } = params;

    // Buscar la categoría actual
    const category = await getCategoryByName(nombre_actual);
    if (!category) {
        return {
            response: `No encontré ninguna categoría llamada "${nombre_actual}". ¿Quieres verificar el nombre?`
        };
    }

    // Validar que sea una categoría personalizada
    const predefinedCategories = [
        'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Otros Gastos'
    ];

    if (predefinedCategories.includes(category.name)) {
        return {
            response: `No puedo editar "${category.name}" porque es una categoría predefinida. Solo puedes editar categorías personalizadas.`
        };
    }

    try {
        // Preparar datos de actualización
        const updateData = {};
        if (nombre_nuevo) updateData.name = nombre_nuevo;
        if (color_nuevo) updateData.color = color_nuevo;
        if (icono_nuevo !== undefined) updateData.icon = icono_nuevo;

        // Actualizar categoría
        const updated = await updateCategory(category.id, updateData);

        // Generar respuesta según lo que se cambió
        const changes = [];
        if (nombre_nuevo) changes.push(`nombre a "${nombre_nuevo}"`);
        if (color_nuevo) changes.push('color');
        if (icono_nuevo !== undefined) changes.push('icono');

        const changesText = changes.join(', ');
        const response = `✅ Listo! Actualicé ${changesText} de la categoría ${updated.icon ? updated.icon : ''} "${updated.name}".`;

        return {
            category: updated,
            response
        };
    } catch (error) {
        console.error('Error editando categoría:', error);

        if (error.message.includes('Ya existe')) {
            return {
                response: `Ya existe una categoría con el nombre "${nombre_nuevo}". ¿Quieres usar otro nombre?`
            };
        }

        return {
            response: `❌ Error al editar la categoría: ${error.message}`
        };
    }
}

/**
 * Maneja la eliminación de una categoría personalizada
 */
async function handleEliminarCategoria(params) {
    const { nombre } = params;

    // Buscar la categoría
    const category = await getCategoryByName(nombre);
    if (!category) {
        return {
            response: `No encontré ninguna categoría llamada "${nombre}". ¿Quieres verificar el nombre?`
        };
    }

    // Validar que sea una categoría personalizada
    const predefinedCategories = [
        'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Otros Gastos'
    ];

    if (predefinedCategories.includes(category.name)) {
        return {
            response: `No puedo eliminar "${category.name}" porque es una categoría predefinida del sistema.`
        };
    }

    try {
        // Eliminar categoría
        const result = await deleteCategory(category.id);

        let response;
        if (result.movedTransactions > 0) {
            response = `✅ Categoría "${result.deleted.name}" eliminada. ${result.movedTransactions} transacción${result.movedTransactions > 1 ? 'es' : ''} ${result.movedTransactions > 1 ? 'fueron movidas' : 'fue movida'} a "${result.movedTo}".`;
        } else {
            response = `✅ Categoría "${result.deleted.name}" eliminada correctamente.`;
        }

        return {
            result,
            response
        };
    } catch (error) {
        console.error('Error eliminando categoría:', error);
        return {
            response: `❌ Error al eliminar la categoría: ${error.message}`
        };
    }
}

/**
 * Maneja el movimiento de transacciones entre categorías
 */
async function handleMoverTransaccionesCategoria(user_phone, params) {
    const { categoria_origen, categoria_destino, tipo } = params;

    // Convertir tipo a formato de BD (solo expense, no hay income)
    const type = 'expense';

    try {
        // Buscar categoría origen
        const fromCategory = await getCategoryByName(categoria_origen);
        if (!fromCategory) {
            return {
                response: `No encontré ninguna categoría llamada "${categoria_origen}". ¿Quieres verificar el nombre?`
            };
        }

        // Verificar que sea una categoría de gastos
        if (fromCategory.type !== 'expense') {
            return {
                response: `La categoría "${categoria_origen}" no es una categoría de gastos válida.`
            };
        }

        // Buscar o crear categoría destino
        let toCategory = await getCategoryByName(categoria_destino);
        if (!toCategory) {
            // Crear automáticamente la categoría destino
            const icon = selectIcon(categoria_destino, type);
            const color = selectColor(type);

            toCategory = await createCategory({
                name: categoria_destino,
                type: type,
                color: color,
                icon: icon
            });

            console.log(`✨ Categoría "${categoria_destino}" creada automáticamente`);
        } else {
            // Verificar que sea una categoría de gastos
            if (toCategory.type !== 'expense') {
                return {
                    response: `La categoría destino "${categoria_destino}" no es una categoría de gastos válida.`
                };
            }
        }

        // Mover las transacciones
        const result = await moveTransactionsBetweenCategories(
            fromCategory.id,
            toCategory.id,
            user_phone
        );

        let response;
        if (result.movedCount > 0) {
            response = `✅ Moví ${result.movedCount} transacción${result.movedCount > 1 ? 'es' : ''} de "${fromCategory.name}" a "${toCategory.name}".`;
        } else {
            response = `No había transacciones en la categoría "${fromCategory.name}" para mover.`;
        }

        return {
            result,
            response
        };
    } catch (error) {
        console.error('Error moviendo transacciones:', error);
        return {
            response: `❌ Error al mover transacciones: ${error.message}`
        };
    }
}

export default {
    verifyWebhookEndpoint,
    receiveWebhook
};
