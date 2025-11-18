/**
 * BUBU - OpenAI Service
 * Servicio para interpretar mensajes de usuario usando OpenAI
 */

import openai from '../config/openai.js';
import { getAllCategories } from './categoryService.js';
import { getChatHistory } from './chatService.js';

/**
 * Define las funciones que OpenAI puede invocar
 * Estas funciones representan las acciones que el usuario puede solicitar
 */
function getOpenAIFunctions() {
    const categories = getAllCategories();

    return [
        {
            name: 'registrar_transaccion',
            description: 'Registra un gasto o ingreso del usuario. Usa esta función cuando el usuario mencione que gastó dinero, pagó algo, recibió dinero, le pagaron, etc.',
            parameters: {
                type: 'object',
                properties: {
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso'],
                        description: 'Tipo de transacción: "gasto" si es un egreso, "ingreso" si es dinero recibido'
                    },
                    monto: {
                        type: 'number',
                        description: 'Monto de la transacción en pesos mexicanos (solo número, sin símbolo de moneda)'
                    },
                    descripcion: {
                        type: 'string',
                        description: 'Descripción breve de la transacción según lo que dijo el usuario'
                    },
                    categoria: {
                        type: 'string',
                        description: 'Nombre de la categoría más apropiada para esta transacción',
                        enum: categories.map(c => c.name)
                    },
                    fecha: {
                        type: 'string',
                        description: 'Fecha de la transacción en formato YYYY-MM-DD. Si el usuario dice "ayer", "hoy", "antier", etc., calcula la fecha correcta. Si no se especifica, usa la fecha actual.'
                    }
                },
                required: ['tipo', 'monto', 'descripcion', 'categoria']
            }
        },
        {
            name: 'consultar_estado',
            description: 'Consulta el estado financiero del usuario. Usa esta función cuando el usuario pregunte cómo va, cuál es su estado, cuánto ha gastado, cuánto ha ganado, etc.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'semana_actual', 'hoy', 'personalizado'],
                        description: 'Periodo de consulta. "mes_actual" para el mes en curso, "mes_pasado" para el mes anterior, etc.'
                    },
                    fecha_inicio: {
                        type: 'string',
                        description: 'Fecha de inicio en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    fecha_fin: {
                        type: 'string',
                        description: 'Fecha de fin en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    filtro_categoria: {
                        type: 'string',
                        description: 'Nombre de categoría específica si el usuario pregunta por una categoría en particular',
                        enum: [...categories.map(c => c.name), null]
                    },
                    filtro_tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso', null],
                        description: 'Filtrar solo gastos o solo ingresos. null para ambos'
                    }
                },
                required: ['periodo']
            }
        },
        {
            name: 'listar_transacciones',
            description: 'Lista transacciones específicas del usuario. Usa esta cuando pregunte "qué gastos tengo", "muestra mis gastos en comida", "ver transacciones de transporte del mes pasado", "qué servicios tengo registrados", etc. IMPORTANTE: usa esta función cuando el usuario quiera VER LA LISTA DETALLADA de transacciones, no solo un resumen.',
            parameters: {
                type: 'object',
                properties: {
                    categoria: {
                        type: 'string',
                        description: 'Categoría específica a listar',
                        enum: [...categories.map(c => c.name), null]
                    },
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso', 'todos'],
                        description: 'Filtrar por tipo de transacción'
                    },
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'semana_actual', 'hoy', 'personalizado', 'todos'],
                        description: 'Periodo temporal para filtrar. "todos" muestra todas las transacciones sin filtro de fecha.'
                    },
                    fecha_inicio: {
                        type: 'string',
                        description: 'Fecha de inicio en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    fecha_fin: {
                        type: 'string',
                        description: 'Fecha de fin en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    limite: {
                        type: 'number',
                        description: 'Número de transacciones a mostrar (por defecto 20)',
                        default: 20
                    }
                }
            }
        },
        {
            name: 'eliminar_transaccion',
            description: 'Elimina una transacción específica. Usa esta cuando el usuario pida eliminar una transacción. Ejemplos: "elimina el 1", "borra el 2", "elimina el gasto de comida", "borra el último", "elimina ese gasto". Si no mencionan un número específico pero hay contexto de una lista reciente, infiere el número basado en lo que piden eliminar.',
            parameters: {
                type: 'object',
                properties: {
                    numero: {
                        type: 'number',
                        description: 'Número de la transacción a eliminar (según la lista mostrada previamente). Si el usuario no menciona un número pero acaba de ver una lista, infiere cuál quiere eliminar. Si solo hay 1 transacción en la lista reciente y pide eliminar, usa numero: 1.'
                    }
                },
                required: ['numero']
            }
        },
        {
            name: 'editar_transaccion',
            description: 'Edita el monto de una transacción. Usa esta cuando diga "cambia el 1 a 500", "edita el 2 a $600", "modifica la transacción 3 a 1000", etc.',
            parameters: {
                type: 'object',
                properties: {
                    numero: {
                        type: 'number',
                        description: 'Número de la transacción a editar'
                    },
                    nuevo_monto: {
                        type: 'number',
                        description: 'Nuevo monto para la transacción'
                    }
                },
                required: ['numero', 'nuevo_monto']
            }
        },
        {
            name: 'conversacion_general',
            description: 'Para saludos, agradecimientos, despedidas o conversación casual que no requiere acción específica',
            parameters: {
                type: 'object',
                properties: {
                    tipo_mensaje: {
                        type: 'string',
                        enum: ['saludo', 'despedida', 'agradecimiento', 'otro'],
                        description: 'Tipo de mensaje casual'
                    }
                },
                required: ['tipo_mensaje']
            }
        }
    ];
}

/**
 * Calcula fechas relativas (ayer, hoy, etc.)
 * @param {string} referencia - Referencia temporal (hoy, ayer, etc.)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function calcularFechaRelativa(referencia) {
    const hoy = new Date();

    switch (referencia?.toLowerCase()) {
        case 'ayer':
            hoy.setDate(hoy.getDate() - 1);
            break;
        case 'antier':
        case 'anteayer':
            hoy.setDate(hoy.getDate() - 2);
            break;
        case 'mañana':
            hoy.setDate(hoy.getDate() + 1);
            break;
        default:
            // hoy
            break;
    }

    return hoy.toISOString().split('T')[0];
}

/**
 * Parsea un mensaje de usuario usando OpenAI
 * @param {string} mensaje - Mensaje del usuario
 * @param {string} userPhone - Teléfono del usuario (para contexto)
 * @returns {object} Intent parseado con la función y argumentos
 */
export async function parseIntent(mensaje, userPhone = null) {
    try {
        const functions = getOpenAIFunctions();
        const today = new Date().toISOString().split('T')[0];

        // Obtener historial de conversación para contexto
        const chatHistory = userPhone ? getChatHistory(userPhone, 10) : [];

        const systemPrompt = `Eres BUBU, un asistente de finanzas personales amigable e inteligente.

Fecha actual: ${today}

Tu trabajo es entender qué quiere hacer el usuario y llamar a la función apropiada.

CATEGORIZACIÓN INTELIGENTE:
- "tacos", "pizza", "restaurante" → Comida
- "uber", "gasolina", "taxi" → Transporte
- "luz", "agua", "internet", "netflix" → Servicios
- Usa tu conocimiento para inferir la categoría correcta

PERIODOS TEMPORALES:
- "este mes", "mes actual", "cuánto llevo" → mes_actual
- "mes pasado", "mes anterior" → mes_pasado
- "esta semana" → semana_actual
- "hoy" → hoy
- Fechas específicas → personalizado

FECHAS RELATIVAS:
- "ayer", "antier", "mañana" → calcula la fecha exacta en YYYY-MM-DD

Usa el historial de conversación para entender referencias como "elimínalo", "el de tacos", etc.`;

        // Construir mensajes con historial
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Agregar últimos mensajes para contexto (máximo 10)
        chatHistory.slice(-10).forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.message
            });
        });

        // Agregar mensaje actual
        messages.push({ role: 'user', content: mensaje });

        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: messages,
            functions: functions,
            function_call: 'auto',
            temperature: 0.4
        });

        const message = response.choices[0].message;

        // Si OpenAI decidió llamar a una función
        if (message.function_call) {
            const functionName = message.function_call.name;
            const args = JSON.parse(message.function_call.arguments);

            return {
                action: functionName,
                parameters: args,
                confidence: 'high',
                rawResponse: message
            };
        }

        // Si no llamó a ninguna función, es conversación general
        return {
            action: 'conversacion_general',
            parameters: { tipo_mensaje: 'otro' },
            confidence: 'medium',
            rawResponse: message
        };

    } catch (error) {
        console.error('Error al parsear intent con OpenAI:', error);
        throw new Error('No pude interpretar tu mensaje. ¿Podrías reformularlo?');
    }
}

/**
 * Genera una respuesta en lenguaje natural para el usuario
 * @param {object} data - Datos para generar la respuesta
 * @returns {string} Respuesta en texto natural
 */
export async function generateNaturalResponse(data) {
    try {
        const { action, result, userMessage, userPhone } = data;

        // Obtener historial de conversación para contexto
        const chatHistory = userPhone ? getChatHistory(userPhone, 10) : [];

        // Preparar contexto basado en la acción
        let contextData = '';

        switch (action) {
            case 'registrar_transaccion':
                contextData = `Acción: Registrar transacción
Tipo: ${result.type === 'expense' ? 'Gasto' : 'Ingreso'}
Monto: $${result.amount}
Categoría: ${result.category_name}
Descripción: ${result.description}`;
                break;

            case 'consultar_estado':
                const periodoTexto = {
                    'mes_actual': 'este mes',
                    'mes_pasado': 'el mes pasado',
                    'semana_actual': 'esta semana',
                    'hoy': 'hoy'
                };
                const periodo = periodoTexto[result.periodo] || 'en el periodo consultado';
                const hasData = result.totals.income > 0 || result.totals.expense > 0;

                if (hasData) {
                    const topCategories = result.byCategory.slice(0, 2).map(c =>
                        `${c.category}: $${c.total}`
                    ).join(', ');

                    contextData = `Acción: Consultar estado financiero
Periodo: ${periodo}
Ingresos: $${result.totals.income}
Gastos: $${result.totals.expense}
Balance: $${result.totals.balance}
Top categorías: ${topCategories}`;
                } else {
                    contextData = `Acción: Consultar estado financiero
Periodo: ${periodo}
Estado: Sin movimientos registrados`;
                }
                break;

            case 'eliminar_transaccion':
                contextData = `Acción: Eliminar transacción #${result.numero}
Monto: $${result.deleted.amount}
Descripción: ${result.deleted.description}`;
                break;

            case 'editar_transaccion':
                contextData = `Acción: Editar transacción #${result.numero}
Monto anterior: $${result.oldAmount}
Monto nuevo: $${result.newAmount}
Descripción: ${result.transaction.description}`;
                break;

            default:
                contextData = 'Acción completada';
        }

        // Construir mensajes con historial
        const messages = [
            {
                role: 'system',
                content: `Eres BUBU, un asistente de finanzas personales amigable y conversacional.

Responde de manera natural y breve (2-3 líneas máximo).
Usa emojis ocasionalmente (máximo 1-2).
Sé positivo, útil y motivador.
Habla como si fueras un amigo que ayuda con finanzas.`
            }
        ];

        // Agregar últimos mensajes para contexto
        chatHistory.slice(-6).forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.message
            });
        });

        // Agregar contexto de la acción ejecutada
        messages.push({
            role: 'user',
            content: `${contextData}

Genera una respuesta natural confirmando esta acción. Sé breve y amigable.`
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: messages,
            temperature: 0.8,
            max_tokens: 150
        });

        return response.choices[0].message.content.trim();

    } catch (error) {
        console.error('Error al generar respuesta natural:', error);
        return 'Operación completada correctamente.';
    }
}

export default {
    parseIntent,
    generateNaturalResponse
};
