/**
 * BUBU - Chat Controller
 * Controlador principal para procesar mensajes del webchat
 */

import { parseIntent, generateNaturalResponse } from '../services/openaiService.js';
import { getOrCreateUser } from '../services/userService.js';
import { createTransaction, getFinancialSummary, getUserTransactions, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { getCategoryByName, suggestCategory } from '../services/categoryService.js';
import { saveChatMessage, getChatHistory } from '../services/chatService.js';
import { saveTransactionList, getTransactionByNumber } from '../services/contextService.js';

/**
 * Procesa un mensaje del usuario
 * Este es el endpoint principal del chat
 */
export async function processMessage(req, res) {
    try {
        const { user_phone, message } = req.body;

        if (!user_phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'user_phone y message son requeridos'
            });
        }

        // Crear o obtener usuario
        const user = getOrCreateUser(user_phone);

        // Parsear intent con OpenAI
        const intent = await parseIntent(message, user_phone);

        // Guardar mensaje del usuario
        saveChatMessage({
            user_phone,
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
                    userMessage: message
                });
                break;

            case 'consultar_estado':
                result = await handleConsultarEstado(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'consultar_estado',
                    result,
                    userMessage: message
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
                    const lista = result.map((t, index) =>
                        `${index + 1}. $${t.amount} - ${t.description} (${t.category_name}) - ${t.transaction_date}`
                    ).join('\n');

                    response = `Encontré ${result.length} transacción${result.length > 1 ? 'es' : ''}:\n\n${lista}\n\nPuedes decir "elimina el 1" o "cambia el 2 a $600" para gestionar tus transacciones.`;
                }
                break;

            case 'eliminar_transaccion':
                result = await handleEliminarTransaccion(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'eliminar_transaccion',
                    result,
                    userMessage: message
                });
                break;

            case 'editar_transaccion':
                result = await handleEditarTransaccion(user_phone, intent.parameters);
                response = await generateNaturalResponse({
                    action: 'editar_transaccion',
                    result,
                    userMessage: message
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
            user_phone,
            role: 'assistant',
            message: response,
            intent_json: null
        });

        return res.json({
            success: true,
            data: {
                intent: intent.action,
                response,
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
    let category = getCategoryByName(categoria);

    // Si no se encuentra, sugerir una basada en la descripción
    if (!category) {
        category = suggestCategory(descripcion, type);
    }

    if (!category) {
        throw new Error(`No encontré la categoría "${categoria}"`);
    }

    // Calcular fecha
    let transactionDate = fecha;
    if (!transactionDate) {
        transactionDate = new Date().toISOString().split('T')[0];
    }

    // Crear transacción
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
    const summary = getFinancialSummary(user_phone, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
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
        const category = getCategoryByName(categoria);
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
            filters.startDate = startDate.toISOString().split('T')[0];
            filters.endDate = endDate.toISOString().split('T')[0];
        }
    }

    return getUserTransactions(user_phone, filters);
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
    deleteTransaction(transaction.id, user_phone);

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
 * Obtiene el historial de chat de un usuario
 */
export async function getHistory(req, res) {
    try {
        const { user_phone } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const history = getChatHistory(user_phone, limit);

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

export default {
    processMessage,
    getHistory
};
