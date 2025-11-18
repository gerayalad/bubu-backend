/**
 * BUBU - WhatsApp Controller
 * Controlador para manejar webhooks de WhatsApp Business API
 */

import { sendWhatsAppMessage, markAsRead, extractMessageFromWebhook, verifyWebhook } from '../services/whatsappService.js';
import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory, getAllCategories } from '../services/categoryService.js';
import { saveChatMessage } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber } from '../services/contextService.js';
import { getTutorialMessage } from '../services/tutorialService.js';
import { downloadWhatsAppMedia } from '../services/whatsappMediaService.js';
import { extractReceiptData, validateReceiptData } from '../services/ocrService.js';
import { saveReceiptImage } from '../services/receiptService.js';

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

            case 'consultar_categorias':
                result = await handleConsultarCategorias(intent.parameters);
                response = result.response;
                break;

            case 'ayuda_uso':
                result = null;
                response = handleAyudaUso(intent.parameters);
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
        await saveChatMessage({
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
        transactionDate = new Date().toISOString().split('T')[0];
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
            filters.startDate = startDate.toISOString().split('T')[0];
            filters.endDate = endDate.toISOString().split('T')[0];
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
            transaction_date: data.date || new Date().toISOString().split('T')[0]
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

export default {
    verifyWebhookEndpoint,
    receiveWebhook
};
