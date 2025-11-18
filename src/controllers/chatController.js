/**
 * BUBU - Chat Controller
 * Controlador principal para procesar mensajes del webchat
 */

import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory, getAllCategories } from '../services/categoryService.js';
import { saveChatMessage, getChatHistory } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber, getPendingReceipt, savePendingReceipt, clearPendingReceipt, savePendingTransaction, getPendingTransaction, clearPendingTransaction, saveLastTransaction, getLastTransaction } from '../services/contextService.js';
import { extractReceiptData, validateReceiptData } from '../services/ocrService.js';
import { saveReceiptImage } from '../services/receiptService.js';
import { getTodayMexico, toMexicoDateString } from '../utils/dateUtils.js';

/**
 * Procesa un mensaje del usuario
 * Este es el endpoint principal del chat
 */
export async function processMessage(req, res) {
    try {
        const { user_phone, message, button_id } = req.body;

        if (!user_phone || (!message && !button_id)) {
            return res.status(400).json({
                success: false,
                error: 'user_phone y (message o button_id) son requeridos'
            });
        }

        // Crear o obtener usuario
        const user = await getOrCreateUser(user_phone);

        // DETECCIÓN TEMPRANA: Verificar si hay una transacción pendiente de confirmación
        const pendingTx = getPendingTransaction(user_phone);
        if (pendingTx) {
            const lowerMsg = message ? message.toLowerCase().trim() : '';

            // Detectar confirmación por botón o texto
            const isAffirmative = button_id === 'confirm_pending' ||
                                ['sí', 'si', 'ok', 'confirmo', 'confirma', 'está bien', 'correcto', 'exacto', 'dale', 'va']
                                .some(word => lowerMsg === word || lowerMsg.startsWith(word + ' '));

            // Detectar cancelación por botón o texto
            const isCancel = button_id === 'cancel_pending' ||
                           ['no', 'cancelar', 'cancela', 'borrar', 'borra', 'descartar']
                           .some(word => lowerMsg === word || lowerMsg.startsWith(word + ' '));

            if (isAffirmative) {
                // Guardar mensaje del usuario
                await saveChatMessage({
                    user_phone: user.phone,
                    role: 'user',
                    message: button_id ? '✅ Confirmar' : message,
                    intent_json: { action: 'confirmar_transaccion_pendiente', button_id }
                });

                // Crear la transacción en la base de datos
                const transaction = await createTransaction({
                    user_phone,
                    category_id: pendingTx.categoria_id,
                    type: pendingTx.type,
                    amount: pendingTx.monto,
                    description: pendingTx.descripcion,
                    transaction_date: pendingTx.fecha
                });

                // Guardar referencia para posibles correcciones
                saveLastTransaction(user_phone, transaction);

                // Limpiar transacción pendiente
                clearPendingTransaction(user_phone);

                const emoji = transaction.type === 'expense' ? '💳' : '💰';
                const tipoText = transaction.type === 'expense' ? 'gasto' : 'ingreso';
                const response = `✅ ¡Listo! Registré tu ${tipoText} de $${transaction.amount} en ${pendingTx.categoria} ${emoji}`;

                await saveChatMessage({
                    user_phone: user.phone,
                    role: 'assistant',
                    message: response,
                    intent_json: null
                });

                return res.json({
                    success: true,
                    data: {
                        intent: 'confirmar_transaccion_pendiente',
                        response,
                        result: transaction
                    }
                });
            } else if (isCancel) {
                // Cancelar la transacción pendiente
                clearPendingTransaction(user_phone);

                await saveChatMessage({
                    user_phone: user.phone,
                    role: 'user',
                    message: button_id ? '❌ Cancelar' : message,
                    intent_json: { action: 'cancelar_transaccion_pendiente', button_id }
                });

                const response = '❌ Transacción cancelada. ¿Hay algo más en lo que pueda ayudarte?';

                await saveChatMessage({
                    user_phone: user.phone,
                    role: 'assistant',
                    message: response,
                    intent_json: null
                });

                return res.json({
                    success: true,
                    data: {
                        intent: 'cancelar_transaccion_pendiente',
                        response,
                        result: null
                    }
                });
            }
            // Si no es afirmativo ni cancelación, continuar con el flujo normal (puede ser una corrección)
        }

        // Parsear intent con OpenAI
        const intent = await parseIntent(message, user_phone);

        // Guardar mensaje del usuario
        await saveChatMessage({
            user_phone: user.phone,
            role: 'user',
            message,
            intent_json: intent
        });

        // Procesar según la acción detectada
        let result;
        let response;

        switch (intent.action) {
            case 'registrar_transaccion':
                result = await handleRegistrarTransaccion(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'registrar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: user_phone
                });
                break;

            case 'consultar_estado':
                result = await handleConsultarEstado(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'consultar_estado',
                    result,
                    userMessage: message,
                    userPhone: user_phone
                });
                break;

            case 'listar_transacciones':
                result = await handleListarTransacciones(user_phone, intent.parameters);
                // Guardar en contexto para poder eliminar/editar después
                saveTransactionList(user_phone, result);

                // Generar respuesta directamente con formato controlado
                if (result.length === 0) {
                    response = 'No encontré transacciones con esos criterios. ¿Quieres registrar una? Puedes decirme algo como "gasté 500 en comida".';
                } else {
                    // Formato estructurado para mensajes interactivos (WhatsApp + Web)
                    const transactionsFormatted = result.map((t, index) => ({
                        id: t.id,
                        number: index + 1,
                        amount: t.amount,
                        description: t.description,
                        category: t.category_name,
                        type: t.type,
                        date: t.transaction_date,
                        displayText: `$${t.amount} - ${t.description}`,
                        emoji: t.type === 'expense' ? '💳' : '💰'
                    }));

                    // Respuesta con metadata para renderizado interactivo
                    response = {
                        type: 'interactive_list',
                        messageType: 'transaction_list',
                        header: `📋 ${result.length} transacción${result.length > 1 ? 'es' : ''}`,
                        body: `Encontré ${result.length} transacción${result.length > 1 ? 'es' : ''} de ${intent.parameters.tipo || 'todos los tipos'}${intent.parameters.categoria ? ` en ${intent.parameters.categoria}` : ''}:`,
                        transactions: transactionsFormatted,
                        actions: ['edit', 'delete'],
                        // Formato texto plano para fallback
                        plainText: `Encontré ${result.length} transacción${result.length > 1 ? 'es' : ''}:\n\n${result.map((t, i) => `${i + 1}. $${t.amount} - ${t.description} (${t.category_name})`).join('\n')}\n\n✏️ Para editar o 🗑️ eliminar, usa los botones interactivos.`
                    };
                }
                break;

            case 'eliminar_transaccion':
                result = await handleEliminarTransaccion(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'eliminar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: user_phone
                });
                break;

            case 'editar_transaccion':
                result = await handleEditarTransaccion(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'editar_transaccion',
                    result,
                    userMessage: message,
                    userPhone: user_phone
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

            case 'confirmar_receipt':
                result = await handleConfirmarReceipt(user_phone, intent.parameters);
                response = result.response;
                break;

            case 'corregir_receipt':
                result = await handleCorregirReceipt(user_phone, intent.parameters);
                response = result.response;
                break;

            case 'proporcionar_monto':
                result = await handleProporcionarMonto(user_phone, intent.parameters);
                response = result.response;
                break;

            case 'confirmar_transaccion':
                result = await handleConfirmarTransaccion(user_phone, intent.parameters);
                response = result.response;
                break;

            case 'corregir_ultima_transaccion':
                result = await handleCorregirUltimaTransaccion(user_phone, intent.parameters);
                response = result.response;
                break;

            default:
                result = null;
                response = 'No estoy seguro de cómo ayudarte con eso. ¿Podrías ser más específico?';
        }

        // Guardar respuesta del asistente
        // Si es un mensaje interactivo, guardar el plainText para historial
        const messageToSave = typeof response === 'object' && response.plainText
            ? response.plainText
            : response;

        await saveChatMessage({
            user_phone: user.phone,
            role: 'assistant',
            message: messageToSave,
            intent_json: typeof response === 'object' ? response : null
        });

        return res.json({
            success: true,
            data: {
                intent: intent.action,
                response, // Devolver el objeto completo para renderizado interactivo
                result
            }
        });

    } catch (error) {
        console.error('Error procesando mensaje:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar el mensaje'
        });
    }
}

/**
 * Maneja el registro de una transacción
 */
async function handleRegistrarTransaccion(user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;

    // Convertir tipo a formato de BD
    const type = tipo === 'gasto' ? 'expense' : 'income';

    // Buscar categoría
    let category = await getCategoryByName(categoria);

    // Si no se encuentra, sugerir una basada en la descripción
    if (!category) {
        category = await suggestCategory(descripcion, type);
    }

    if (!category) {
        throw new Error(`No encontré la categoría "${categoria}"`);
    }

    // Calcular fecha
    let transactionDate = fecha;
    if (!transactionDate) {
        transactionDate = getTodayMexico();
    }

    // Crear transacción
    const transaction = await createTransaction({
        user_phone,
        category_id: category.id,
        type,
        amount: monto,
        description: descripcion,
        transaction_date: transactionDate
    });

    // Guardar referencia para posibles correcciones
    saveLastTransaction(user_phone, transaction);

    return transaction;
}

/**
 * Maneja consultas de estado financiero
 */
async function handleConsultarEstado(user_phone, params) {
    const { periodo, fecha_inicio, fecha_fin, filtro_categoria, filtro_tipo } = params;

    // Calcular fechas según el periodo
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

    // Obtener resumen
    const summary = await getFinancialSummary(user_phone, {
        startDate: toMexicoDateString(startDate),
        endDate: toMexicoDateString(endDate)
    });

    // Agregar el periodo original al summary para contexto
    summary.periodo = periodo;

    // Aplicar filtros adicionales si los hay
    if (filtro_categoria) {
        summary.byCategory = summary.byCategory.filter(c => c.category === filtro_categoria);
    }

    if (filtro_tipo) {
        const type = filtro_tipo === 'gasto' ? 'expense' : 'income';
        summary.byCategory = summary.byCategory.filter(c => c.type === type);
    }

    return summary;
}

/**
 * Maneja listado de transacciones
 */
async function handleListarTransacciones(user_phone, params) {
    const { categoria, limite = 20, tipo = 'todos', periodo = 'todos', fecha_inicio, fecha_fin } = params;

    const filters = {
        limit: limite
    };

    if (tipo !== 'todos') {
        filters.type = tipo === 'gasto' ? 'expense' : 'income';
    }

    // Filtrar por categoría si se especifica
    if (categoria) {
        const category = await getCategoryByName(categoria);
        if (category) {
            filters.category_id = category.id;
        }
    }

    // Calcular fechas según el periodo
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

/**
 * Maneja eliminación de una transacción por número
 */
async function handleEliminarTransaccion(user_phone, params) {
    const { numero } = params;

    // Obtener transacción del contexto
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    // Eliminar transacción
    await deleteTransaction(transaction.id, user_phone);

    return {
        deleted: transaction,
        numero: numero
    };
}

/**
 * Maneja edición del monto de una transacción
 */
async function handleEditarTransaccion(user_phone, params) {
    const { numero, nuevo_monto } = params;

    // Obtener transacción del contexto
    const transaction = getTransactionByNumber(user_phone, numero);

    if (!transaction) {
        throw new Error(`No encontré la transacción #${numero}. ¿Podrías pedirme que liste las transacciones primero?`);
    }

    const oldAmount = transaction.amount;

    // Actualizar transacción
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

/**
 * Maneja conversación general
 */
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
 * Maneja la confirmación de un receipt pendiente
 */
async function handleConfirmarReceipt(user_phone, params) {
    // Obtener el receipt pendiente del contexto
    const pendingReceipt = getPendingReceipt(user_phone);

    if (!pendingReceipt) {
        return {
            response: '🤔 No tengo ningún ticket pendiente de confirmación. ¿Puedes enviar la imagen nuevamente?'
        };
    }

    const { ocrData } = pendingReceipt;

    // Buscar la categoría
    const category = await getCategoryByName(ocrData.category);

    if (!category) {
        clearPendingReceipt(user_phone);
        return {
            response: `No encontré la categoría "${ocrData.category}". Por favor, envía el ticket nuevamente.`
        };
    }

    // Crear la transacción
    const transaction = await createTransaction({
        user_phone,
        category_id: category.id,
        type: 'expense',
        amount: ocrData.amount,
        description: ocrData.description || `Compra en ${ocrData.merchant}`,
        transaction_date: ocrData.date || getTodayMexico()
    });

    // Actualizar receipt en BD
    if (pendingReceipt.receiptId) {
        await saveReceiptImage({
            user_phone,
            whatsapp_media_id: null,
            media_url: null,
            ocr_result: ocrData,
            transaction_id: transaction.id,
            status: 'processed'
        });
    }

    // Limpiar contexto
    clearPendingReceipt(user_phone);

    return {
        transaction,
        response: `✅ ¡Perfecto! Registré el gasto de $${ocrData.amount} en ${ocrData.category} 📸`
    };
}

/**
 * Maneja la corrección de un receipt pendiente
 */
async function handleCorregirReceipt(user_phone, params) {
    const { monto_correcto, descripcion_correcta, categoria_correcta } = params;

    // Obtener el receipt pendiente del contexto
    const pendingReceipt = getPendingReceipt(user_phone);

    if (!pendingReceipt) {
        return {
            response: '🤔 No tengo ningún ticket pendiente de corrección. ¿Puedes enviar la imagen nuevamente?'
        };
    }

    const { ocrData } = pendingReceipt;

    // Aplicar correcciones
    const correctedData = {
        ...ocrData,
        amount: monto_correcto || ocrData.amount,
        description: descripcion_correcta || ocrData.description,
        category: categoria_correcta || ocrData.category
    };

    // Buscar la categoría
    const category = await getCategoryByName(correctedData.category);

    if (!category) {
        clearPendingReceipt(user_phone);
        return {
            response: `No encontré la categoría "${correctedData.category}". Por favor, especifica una categoría válida.`
        };
    }

    // Crear la transacción con datos corregidos
    const transaction = await createTransaction({
        user_phone,
        category_id: category.id,
        type: 'expense',
        amount: correctedData.amount,
        description: correctedData.description || `Compra en ${correctedData.merchant}`,
        transaction_date: correctedData.date || getTodayMexico()
    });

    // Actualizar receipt en BD
    if (pendingReceipt.receiptId) {
        await saveReceiptImage({
            user_phone,
            whatsapp_media_id: null,
            media_url: null,
            ocr_result: correctedData,
            transaction_id: transaction.id,
            status: 'processed'
        });
    }

    // Limpiar contexto
    clearPendingReceipt(user_phone);

    return {
        transaction,
        response: `✅ ¡Corregido! Registré el gasto de $${correctedData.amount} en ${correctedData.category} 📝`
    };
}

/**
 * Maneja la provisión de un monto faltante para un receipt
 */
async function handleProporcionarMonto(user_phone, params) {
    const { monto } = params;

    // Obtener el receipt pendiente del contexto
    const pendingReceipt = getPendingReceipt(user_phone);

    if (!pendingReceipt) {
        return {
            response: '🤔 No tengo ningún ticket pendiente. ¿Puedes enviar la imagen nuevamente?'
        };
    }

    const { ocrData } = pendingReceipt;

    // Agregar el monto proporcionado
    const completeData = {
        ...ocrData,
        amount: monto
    };

    // Buscar la categoría
    const category = await getCategoryByName(completeData.category);

    if (!category) {
        clearPendingReceipt(user_phone);
        return {
            response: `No encontré la categoría "${completeData.category}". Por favor, envía el ticket nuevamente.`
        };
    }

    // Crear la transacción
    const transaction = await createTransaction({
        user_phone,
        category_id: category.id,
        type: 'expense',
        amount: completeData.amount,
        description: completeData.description || `Compra en ${completeData.merchant}`,
        transaction_date: completeData.date || getTodayMexico()
    });

    // Actualizar receipt en BD
    if (pendingReceipt.receiptId) {
        await saveReceiptImage({
            user_phone,
            whatsapp_media_id: null,
            media_url: null,
            ocr_result: completeData,
            transaction_id: transaction.id,
            status: 'processed'
        });
    }

    // Limpiar contexto
    clearPendingReceipt(user_phone);

    return {
        transaction,
        response: `✅ ¡Listo! Registré el gasto de $${monto} en ${completeData.category} 📸`
    };
}

/**
 * Obtiene el historial de chat de un usuario
 */
export async function getHistory(req, res) {
    try {
        const { user_phone } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const history = await getChatHistory(user_phone, limit);

        return res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('Error obteniendo historial:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Procesa una imagen del webchat (OCR de tickets)
 */
export async function processImageMessage(req, res) {
    try {
        const { user_phone, image_base64, mime_type } = req.body;

        if (!user_phone || !image_base64) {
            return res.status(400).json({
                success: false,
                error: 'user_phone e image_base64 son requeridos'
            });
        }

        // Crear o obtener usuario
        const user = await getOrCreateUser(user_phone);
        const normalizedPhone = user.phone;

        console.log(`📸 Procesando imagen del usuario ${normalizedPhone}...`);

        // Extraer datos con OCR
        const ocrResult = await extractReceiptData(image_base64, mime_type || 'image/jpeg');

        if (!ocrResult.success) {
            return res.json({
                success: true,
                data: {
                    response: '😕 No pude leer el ticket claramente. Intenta con una imagen más nítida o escribe los datos manualmente.',
                    ocr_success: false
                }
            });
        }

        const { data } = ocrResult;
        const validation = validateReceiptData(data);

        // Guardar mensaje del usuario (imagen)
        await saveChatMessage({
            user_phone: normalizedPhone,
            role: 'user',
            message: '📸 [Imagen de ticket enviada]',
            intent_json: { action: 'ocr_receipt', ocr_data: data }
        });

        // Si falta el monto
        if (!validation.isValid && validation.missingFields.includes('amount')) {
            const response = '🤔 Vi el ticket pero no pude leer el monto claramente. ¿Me lo puedes decir? Por ejemplo: "500"';

            const receiptRecord = await saveReceiptImage({
                user_phone: normalizedPhone,
                whatsapp_media_id: null,
                media_url: null,
                ocr_result: data,
                transaction_id: null,
                status: 'pending'
            });

            // Guardar en contexto para poder completar después
            savePendingReceipt(normalizedPhone, {
                ocrData: data,
                receiptId: receiptRecord.id,
                status: 'needs_amount'
            });

            await saveChatMessage({
                user_phone: normalizedPhone,
                role: 'assistant',
                message: response,
                intent_json: null
            });

            return res.json({
                success: true,
                data: {
                    response,
                    ocr_success: true,
                    ocr_data: data,
                    needs_amount: true
                }
            });
        }

        // Si la confianza es baja (< 70%)
        if (validation.needsConfirmation) {
            const response = `Vi un gasto de $${data.amount} en ${data.category}.\n\n¿Es correcto? Puedes responder "sí" o corregirme.`;

            const receiptRecord = await saveReceiptImage({
                user_phone: normalizedPhone,
                whatsapp_media_id: null,
                media_url: null,
                ocr_result: data,
                transaction_id: null,
                status: 'pending_confirmation'
            });

            // Guardar en contexto para poder confirmar/corregir después
            savePendingReceipt(normalizedPhone, {
                ocrData: data,
                receiptId: receiptRecord.id,
                status: 'needs_confirmation'
            });

            await saveChatMessage({
                user_phone: normalizedPhone,
                role: 'assistant',
                message: response,
                intent_json: null
            });

            return res.json({
                success: true,
                data: {
                    response,
                    ocr_success: true,
                    ocr_data: data,
                    needs_confirmation: true
                }
            });
        }

        // Alta confianza: crear transacción automáticamente
        const category = await getCategoryByName(data.category);

        if (!category) {
            return res.json({
                success: true,
                data: {
                    response: `No encontré la categoría "${data.category}". ¿Puedes especificar una categoría válida?`,
                    ocr_success: true,
                    ocr_data: data,
                    needs_category: true
                }
            });
        }

        const transaction = await createTransaction({
            user_phone: normalizedPhone,
            category_id: category.id,
            type: 'expense',
            amount: data.amount,
            description: data.description || `Compra en ${data.merchant}`,
            transaction_date: data.date || getTodayMexico()
        });

        await saveReceiptImage({
            user_phone: normalizedPhone,
            whatsapp_media_id: null,
            media_url: null,
            ocr_result: data,
            transaction_id: transaction.id,
            status: 'processed'
        });

        const response = `✅ ¡Listo! Registré un gasto de $${data.amount} en ${data.category} 📸\n\n"${transaction.description}"`;

        await saveChatMessage({
            user_phone: normalizedPhone,
            role: 'assistant',
            message: response,
            intent_json: null
        });

        return res.json({
            success: true,
            data: {
                response,
                ocr_success: true,
                ocr_data: data,
                transaction,
                auto_created: true
            }
        });

    } catch (error) {
        console.error('❌ Error procesando imagen:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar la imagen'
        });
    }
}

/**
 * Prepara una transacción para confirmación del usuario
 */
async function handleConfirmarTransaccion(user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;

    // Convertir tipo a formato de BD
    const type = tipo === 'gasto' ? 'expense' : 'income';

    // Buscar categoría
    let category = await getCategoryByName(categoria);

    // Si no se encuentra, sugerir una basada en la descripción
    if (!category) {
        category = await suggestCategory(descripcion, type);
    }

    if (!category) {
        throw new Error(`No encontré la categoría "${categoria}"`);
    }

    // Calcular fecha
    let transactionDate = fecha;
    if (!transactionDate) {
        transactionDate = getTodayMexico();
    }

    // Guardar en contexto pendiente (NO crear en BD todavía)
    const pendingData = {
        tipo,
        monto,
        descripcion,
        categoria: category.name,
        categoria_id: category.id,
        fecha: transactionDate,
        type
    };

    savePendingTransaction(user_phone, pendingData);

    // Formatear la fecha para mostrar
    const [year, month, day] = transactionDate.split('-');
    const displayDate = `${day}/${month}`;

    // Preparar emoji según tipo
    const emoji = type === 'expense' ? '💳' : '💰';
    const tipoText = type === 'expense' ? 'Gasto' : 'Ingreso';

    // Generar respuesta de confirmación con botones interactivos
    const body = `📝 ¿Confirmas esta transacción?

${emoji} **$${monto.toFixed(2)}**
📁 ${category.name}
📝 ${descripcion}
📅 ${displayDate}
${tipoText}`;

    const response = {
        type: 'interactive_buttons',
        messageType: 'transaction_confirmation',
        body,
        buttons: [
            { id: 'confirm_pending', title: '✅ Confirmar' },
            { id: 'cancel_pending', title: '❌ Cancelar' }
        ],
        pendingTransaction: pendingData,
        plainText: `${body}\n\nResponde "sí" para confirmar o "cancelar" para descartar.`
    };

    return {
        response
    };
}

/**
 * Corrige un campo de la última transacción creada
 */
async function handleCorregirUltimaTransaccion(user_phone, params) {
    const { campo, nuevo_valor_categoria, nuevo_valor_monto, nuevo_valor_descripcion, nuevo_valor_fecha } = params;

    // Obtener la última transacción del usuario
    const lastTx = getLastTransaction(user_phone);

    if (!lastTx) {
        return {
            response: '🤔 No encuentro ninguna transacción reciente para corregir. Las correcciones solo están disponibles por 10 minutos después de crear una transacción.'
        };
    }

    // Preparar datos de actualización según el campo
    const updateData = {};

    switch (campo) {
        case 'categoria':
            if (!nuevo_valor_categoria) {
                return { response: '❌ Necesito saber a qué categoría quieres cambiarla.' };
            }
            const category = await getCategoryByName(nuevo_valor_categoria);
            if (!category) {
                return { response: `❌ No encontré la categoría "${nuevo_valor_categoria}".` };
            }
            updateData.category_id = category.id;
            break;

        case 'monto':
            if (!nuevo_valor_monto) {
                return { response: '❌ Necesito saber cuál es el monto correcto.' };
            }
            updateData.amount = nuevo_valor_monto;
            break;

        case 'descripcion':
            if (!nuevo_valor_descripcion) {
                return { response: '❌ Necesito saber cuál es la descripción correcta.' };
            }
            updateData.description = nuevo_valor_descripcion;
            break;

        case 'fecha':
            if (!nuevo_valor_fecha) {
                return { response: '❌ Necesito saber cuál es la fecha correcta (formato: YYYY-MM-DD).' };
            }
            updateData.transaction_date = nuevo_valor_fecha;
            break;

        default:
            return { response: '❌ Campo no válido. Puedes corregir: categoría, monto, descripción o fecha.' };
    }

    // Actualizar la transacción
    try {
        const updatedTransaction = await updateTransaction(lastTx.id, user_phone, updateData);

        // Actualizar la referencia en contexto
        saveLastTransaction(user_phone, updatedTransaction);

        // Generar respuesta
        let fieldName;
        let newValue;

        switch (campo) {
            case 'categoria':
                fieldName = 'categoría';
                newValue = nuevo_valor_categoria;
                break;
            case 'monto':
                fieldName = 'monto';
                newValue = `$${nuevo_valor_monto}`;
                break;
            case 'descripcion':
                fieldName = 'descripción';
                newValue = nuevo_valor_descripcion;
                break;
            case 'fecha':
                fieldName = 'fecha';
                const [year, month, day] = nuevo_valor_fecha.split('-');
                newValue = `${day}/${month}/${year}`;
                break;
        }

        return {
            response: `✅ Listo, actualicé ${fieldName} a: **${newValue}**`
        };

    } catch (error) {
        console.error('Error corrigiendo transacción:', error);
        return {
            response: `❌ Error al corregir la transacción: ${error.message}`
        };
    }
}

export default {
    processMessage,
    getHistory,
    processImageMessage
};
